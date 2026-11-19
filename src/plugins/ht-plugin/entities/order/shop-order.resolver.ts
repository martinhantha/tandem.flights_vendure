import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { MutationAddItemToOrderArgs, MutationAdjustOrderLineArgs, MutationRemoveOrderLineArgs, MutationApplyCouponCodeArgs, ApplyCouponCodeResult, RemoveOrderItemsResult, Permission, UpdateOrderItemsResult, CouponCodeInvalidError, ErrorCode, MutationTransitionOrderToStateArgs, TransitionOrderToStateResult, OrderStateTransitionError } from "@vendure/common/lib/generated-shop-types"
import { ACTIVE_ORDER_INPUT_FIELD_NAME, ActiveOrderService, Allow, Ctx, ErrorResultUnion, Logger, Order, OrderState, RequestContext, Transaction } from "@vendure/core"
import { MyOrderService } from "./shop-order.service"
import i18next from "i18next"
import { VoucherService, getVoucherValidity } from "../voucher/service"
import { isOnlineVoucherRedemptionEnabled } from "../../constants"

type ActiveOrderArgs = { [ACTIVE_ORDER_INPUT_FIELD_NAME]?: any }

@Resolver()
export class OverrideShopOrderResolver {
    constructor(
        private orderService: MyOrderService,
        private activeOrderService: ActiveOrderService,
        private voucherService: VoucherService,
    ) {}

    @Transaction()
    @Mutation()
    @Allow(Permission.UpdateOrder, Permission.Owner)
    async addItemToOrder(@Ctx() ctx: RequestContext, @Args() args: MutationAddItemToOrderArgs & ActiveOrderArgs): Promise<ErrorResultUnion<UpdateOrderItemsResult, Order>> {
        const order = await this.activeOrderService.getActiveOrder(ctx, args[ACTIVE_ORDER_INPUT_FIELD_NAME], true)
        return this.orderService.addItemToOrder(ctx, order.id, args.productVariantId, args.quantity, (args as any).customFields)
    }

    @Transaction()
    @Mutation()
    @Allow(Permission.UpdateOrder, Permission.Owner)
    async adjustOrderLine(@Ctx() ctx: RequestContext, @Args() args: MutationAdjustOrderLineArgs & ActiveOrderArgs): Promise<ErrorResultUnion<UpdateOrderItemsResult, Order>> {
        const order = await this.activeOrderService.getActiveOrder(ctx, args[ACTIVE_ORDER_INPUT_FIELD_NAME], true)
        return this.orderService.adjustOrderLine(ctx, order.id, args.orderLineId, args.quantity, (args as any).customFields)
    }

    @Transaction()
    @Mutation()
    @Allow(Permission.UpdateOrder, Permission.Owner)
    async removeOrderLine(@Ctx() ctx: RequestContext, @Args() args: MutationRemoveOrderLineArgs & ActiveOrderArgs): Promise<ErrorResultUnion<RemoveOrderItemsResult, Order>> {
        const order = await this.activeOrderService.getActiveOrder(ctx, args[ACTIVE_ORDER_INPUT_FIELD_NAME], true)
        return this.orderService.removeOrderLine(ctx, order.id, args.orderLineId)
    }

    @Transaction()
    @Mutation()
    @Allow(Permission.UpdateOrder, Permission.Owner)
    async applyCouponCode(@Ctx() ctx: RequestContext, @Args() args: MutationApplyCouponCodeArgs & ActiveOrderArgs): Promise<ErrorResultUnion<ApplyCouponCodeResult, Order>> {
        const coupon = await this.voucherService.findOneByCode(ctx, args.couponCode)
        Logger.debug(`applyCouponCode ${args.couponCode}: voucher ${coupon?.id ?? "-"}, amount ${coupon?.amount ?? "-"}`, "OverrideShopOrderResolver")

        if (coupon && !isOnlineVoucherRedemptionEnabled()) {
            const error: CouponCodeInvalidError = {
                __typename: "CouponCodeInvalidError",
                couponCode: args.couponCode,
                errorCode: ErrorCode.COUPON_CODE_INVALID_ERROR,
                message: i18next.t("message.error.couponLocalOnly", { lng: ctx.languageCode }),
            }
            return error
        }
        if (coupon?.amount === 0) {
            const error: CouponCodeInvalidError = {
                __typename: "CouponCodeInvalidError",
                couponCode: args.couponCode,
                errorCode: ErrorCode.COUPON_CODE_LIMIT_ERROR,
                message: i18next.t("message.error.couponValueExhausted", { lng: ctx.languageCode }),
            }
            return error
        }
        // only our own vouchers carry a validity period - an unknown code may still be a promotion coupon
        const validity = coupon ? getVoucherValidity(coupon) : { valid: true as const }
        if (!validity.valid) {
            const error: CouponCodeInvalidError = {
                __typename: "CouponCodeInvalidError",
                couponCode: args.couponCode,
                errorCode: ErrorCode.COUPON_CODE_EXPIRED_ERROR,
                message: i18next.t(validity.reason === "expired" ? "message.error.couponExpired" : "message.error.couponNotYetValid", { lng: ctx.languageCode }),
            }
            return error
        }

        let order: Order = await this.activeOrderService.getActiveOrder(ctx, args[ACTIVE_ORDER_INPUT_FIELD_NAME], true)

        if (!order.lines) {
            // Fetch the order lines if not included
            const tempOrder = await this.orderService.findOne(ctx, order.id)
            if (tempOrder) order = tempOrder
        }

        if (!coupon) return this.orderService.applyCouponCode(ctx, order.id, args.couponCode)

        const applied = await this.orderService.applyCouponCodeCustom(ctx, order, coupon)
        if (!applied) {
            const error: CouponCodeInvalidError = {
                __typename: "CouponCodeInvalidError",
                couponCode: args.couponCode,
                errorCode: ErrorCode.COUPON_CODE_INVALID_ERROR,
                message: i18next.t("message.error.couponNothingToDiscount", { lng: ctx.languageCode }),
            }
            return error
        }
        return applied
    }

    /**
     * Last recalculation before the customer pays: removes vouchers that were deleted or are no longer valid, and
     * caps the rest at their current balance (the same voucher may have been used on another order meanwhile).
     * The shop starts the payment right after this step, so if a voucher changed the order stays where it is and
     * the customer gets a message instead of being sent to the payment with a higher total.
     */
    @Transaction()
    @Mutation()
    @Allow(Permission.UpdateOrder, Permission.Owner)
    async transitionOrderToState(@Ctx() ctx: RequestContext, @Args() args: MutationTransitionOrderToStateArgs & ActiveOrderArgs): Promise<ErrorResultUnion<TransitionOrderToStateResult, Order> | undefined> {
        if (!ctx.authorizedAsOwnerOnly) return
        const order = await this.activeOrderService.getActiveOrder(ctx, args[ACTIVE_ORDER_INPUT_FIELD_NAME], true)
        if (args.state === "ArrangingPayment") {
            const fullOrder = await this.orderService.findOne(ctx, order.id, ["lines", "lines.productVariant", "surcharges"])
            const notices = fullOrder ? (await this.orderService.doSurchargersCouponUpdate(ctx, fullOrder)).notices : []
            if (notices.length) {
                const message = notices.map((notice) => i18next.t(`message.error.voucherNotice.${notice.reason}`, { lng: ctx.languageCode, code: notice.code })).join(" ")
                const error: OrderStateTransitionError = {
                    __typename: "OrderStateTransitionError",
                    errorCode: ErrorCode.ORDER_STATE_TRANSITION_ERROR,
                    message,
                    transitionError: message,
                    fromState: order.state,
                    toState: args.state,
                }
                return error
            }
        }
        return this.orderService.transitionToState(ctx, order.id, args.state as OrderState)
    }

    @Transaction()
    @Mutation()
    @Allow(Permission.UpdateOrder, Permission.Owner)
    async setOrderSelectedPaymentMethod(@Ctx() ctx: RequestContext, @Args() args: { paymentMethodCode?: string | null } & ActiveOrderArgs): Promise<Order | null> {
        const activeOrder = await this.activeOrderService.getActiveOrder(ctx, args[ACTIVE_ORDER_INPUT_FIELD_NAME], true)
        if (!activeOrder) return null
        await this.orderService.updateCustomFields(ctx, activeOrder.id, { selectedPaymentMethodCode: args.paymentMethodCode ?? null })
        return this.orderService.recalcAfterPaymentMethodChange(ctx, activeOrder.id)
    }

    @Transaction()
    @Mutation()
    @Allow(Permission.UpdateOrder, Permission.Owner)
    async removeCouponCode(@Ctx() ctx: RequestContext, @Args() args: MutationApplyCouponCodeArgs & ActiveOrderArgs): Promise<Order> {
        let order: Order = await this.activeOrderService.getActiveOrder(ctx, args[ACTIVE_ORDER_INPUT_FIELD_NAME], true)

        if (!order.lines) {
            // Fetch the order lines if not included
            const tempOrder = await this.orderService.findOne(ctx, order.id)
            if (tempOrder) order = tempOrder
        }
        const coupon = await this.voucherService.findOneByCode(ctx, args.couponCode)

        Logger.debug(`removeCouponCode ${args.couponCode}: voucher ${coupon?.id ?? "-"}`, "OverrideShopOrderResolver")
        if (!coupon) return this.orderService.removeCouponCode(ctx, order.id, args.couponCode)
        return this.orderService.removeCouponCodeCustom(ctx, order, coupon)
    }

    /**
     * The withdrawal form itself lives in TYPO3, so the shop reports a successful submission back
     * here. The service checks that the order really belongs to the logged in customer.
     */
    @Transaction()
    @Mutation()
    @Allow(Permission.Authenticated)
    async incrementOrderWithdrawalCount(@Ctx() ctx: RequestContext, @Args() args: { orderCode: string }): Promise<number> {
        return this.orderService.incrementOrderWithdrawalCount(ctx, args.orderCode)
    }
}
