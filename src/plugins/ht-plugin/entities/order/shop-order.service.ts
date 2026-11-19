import { Injectable } from "@nestjs/common"
import { HistoryEntryType } from "@vendure/common/lib/generated-types"
import { RequestContext, OrderService, ID, Order, ErrorResultUnion, TransactionalConnection, ConfigService, ProductVariantService, CustomerService, CountryService, OrderCalculator, OrderStateMachine, OrderMerger, PaymentService, PaymentMethodService, FulfillmentService, ListQueryBuilder, HistoryService, PromotionService, EventBus, ChannelService, OrderModifier, CustomFieldRelationService, RequestContextCacheService, TranslatorService, StockLevelService, OrderLine, ShippingLine, Surcharge, Logger, EntityNotFoundError, ForbiddenError, idsAreEqual } from "@vendure/core"
import { CouponCodeEvent } from "@vendure/core/dist/event-bus/events/coupon-code-event"
import { RefundStateMachine } from "@vendure/core/dist/service/helpers/refund-state-machine/refund-state-machine"
import { ShippingCalculator } from "@vendure/core/dist/service/helpers/shipping-calculator/shipping-calculator"
import { loggerCtx, couponSku, isCouponSku, couponCodeFromSku } from "../../constants"
import { VoucherService, getVoucherValidity } from "../voucher/service"
import { omit } from "@vendure/common/lib/omit"
import { UpdateOrderItemsResult } from "@vendure/common/lib/generated-types"

export const DEFAULT_INTERVAL_RESERVATION = 15

/** A voucher that was removed from the order, or whose discount had to shrink because its balance dropped. */
export type VoucherNotice = { code: string; reason: "deleted" | "expired" | "notYetValid" | "balance" }

@Injectable()
export class MyOrderService extends OrderService {
    constructor(connection: TransactionalConnection, configService: ConfigService, productVariantService: ProductVariantService, customerService: CustomerService, countryService: CountryService, orderCalculator: OrderCalculator, shippingCalculator: ShippingCalculator, orderStateMachine: OrderStateMachine, orderMerger: OrderMerger, paymentService: PaymentService, paymentMethodService: PaymentMethodService, fulfillmentService: FulfillmentService, listQueryBuilder: ListQueryBuilder, refundStateMachine: RefundStateMachine, historyService: HistoryService, promotionService: PromotionService, eventBus: EventBus, channelService: ChannelService, orderModifier: OrderModifier, customFieldRelationService: CustomFieldRelationService, requestCache: RequestContextCacheService, translator: TranslatorService, stockLevelService: StockLevelService, voucherService: VoucherService) {
        super(connection, configService, productVariantService, customerService, countryService, orderCalculator, shippingCalculator, orderStateMachine, orderMerger, paymentService, paymentMethodService, fulfillmentService, listQueryBuilder, refundStateMachine, historyService, promotionService, eventBus, channelService, orderModifier, customFieldRelationService, requestCache, translator, stockLevelService)
        this.connectionLocal = connection
        this.voucherService = voucherService
        this.orderCalculatorDirect = orderCalculator
        this.promotionServiceDirect = promotionService
        this.historyServiceRef = historyService
        this.eventBusRef = eventBus
    }
    connectionLocal: TransactionalConnection
    voucherService: VoucherService
    private readonly orderCalculatorDirect: OrderCalculator
    private readonly promotionServiceDirect: PromotionService
    private readonly historyServiceRef: HistoryService
    private readonly eventBusRef: EventBus

    /**
     * Core OrderService is still registered in ServiceCoreModule and registers blocking event handlers once.
     * This subclass must not call super.onApplicationBootstrap() or those handlers are registered twice.
     */
    onApplicationBootstrap(): void {}

    async addItemToOrder(ctx: RequestContext, orderId: ID, productVariantId: ID, quantity: number, customFields?: { [key: string]: any }) {
        // get Current Order

        await super.updateCustomFields(ctx, orderId, { languageCode: ctx.languageCode })

        const result = await super.addItemToOrder(ctx, orderId, productVariantId, quantity, customFields)
        return this.afterOrderLinesChanged(ctx, orderId, result)
    }
    async adjustOrderLine(ctx: RequestContext, orderId: ID, orderLineId: ID, quantity: number, customFields?: { [key: string]: any }) {
        const result = await super.adjustOrderLine(ctx, orderId, orderLineId, quantity, customFields)
        return this.afterOrderLinesChanged(ctx, orderId, result)
    }
    /**
     * Voucher surcharges are capped at the value of the order lines, so they have to follow every line change.
     * This includes adjustOrderLine with quantity 0, which removes the line just like removeOrderLine.
     */
    private async afterOrderLinesChanged<T>(ctx: RequestContext, orderId: ID, result: T): Promise<T> {
        if (!(result instanceof Order)) return result
        const fullOrder = await this.findOne(ctx, orderId, ["lines", "lines.productVariant", "lines.productVariant.facetValues", "lines.productVariant.facetValues.facet", "surcharges"])
        const { order: updated } = await this.doSurchargersCouponUpdate(ctx, fullOrder ?? result)
        return this.maybeRecalcForSelectedPaymentMethod(ctx, orderId, updated as unknown as T)
    }
    private async maybeRecalcForSelectedPaymentMethod<T>(ctx: RequestContext, orderId: ID, result: T): Promise<T> {
        if (!(result instanceof Order)) return result
        const order = await this.findOne(ctx, orderId)
        if (!order?.customFields?.selectedPaymentMethodCode) return result
        const recalced = await this.recalcAfterPaymentMethodChange(ctx, orderId)
        return recalced as unknown as T
    }
    /**
     * Re-caps every voucher on the order at the goods value and its current balance, and removes vouchers that were
     * deleted or are outside their validity period. Returns the vouchers the customer has to be told about.
     */
    async doSurchargersCouponUpdate(ctx: RequestContext, order: Order): Promise<{ order: Order; notices: VoucherNotice[] }> {
        const surcharges = await this.getOrderSurcharges(ctx, order.id)
        let addSurchargeResult = order
        const notices: VoucherNotice[] = []

        const surchargeCoupons: Surcharge[] = surcharges.filter((surcharge) => isCouponSku(surcharge.sku))

        if (surchargeCoupons.length === 0) return { order, notices }

        Logger.debug("doSurchargersCoupon update " + JSON.stringify(surchargeCoupons, null, 2), loggerCtx)

        const surchargeCouponsReversed = surchargeCoupons.reverse()
        const couponIds = Array.from(new Set(surchargeCouponsReversed.map((s) => couponCodeFromSku(s.sku)).filter(Boolean)))
        const couponList = await this.voucherService.findAll(ctx, {
            take: couponIds.length,
            filter: {
                code: { in: couponIds },
            },
        })
        const couponByCodeMap = new Map(couponList.items.map((c) => [c.code, c]))

        for (const surcharge of surchargeCouponsReversed) {
            const couponCode = couponCodeFromSku(surcharge.sku)

            const realProductPrice = this.getRealProductPriceForVouchers(addSurchargeResult, couponCode)
            Logger.debug(`doSurchargersCouponUpdate ${couponCode}: realProductPrice ${realProductPrice}`, loggerCtx)

            // findAll skips deleted vouchers, so a missing one was deleted. A deleted, expired or not yet valid
            // voucher gets a discount of 0, which removes its row below instead of keeping the old discount.
            const coupon = couponByCodeMap.get(couponCode)
            const validity = coupon ? getVoucherValidity(coupon) : ({ valid: false, reason: "deleted" } as const)
            if (!validity.valid) {
                Logger.warn(`Order ${order.code}: voucher ${couponCode} is ${validity.reason}, removing it`, loggerCtx)
                notices.push({ code: couponCode, reason: validity.reason })
            } else if (coupon && coupon.amount < -surcharge.listPrice) {
                // the balance dropped since the voucher was applied, e.g. it was used on another order meanwhile
                notices.push({ code: couponCode, reason: "balance" })
            }
            const amountDiscount = coupon && validity.valid ? Math.min(coupon.amount, realProductPrice) : 0

            // unchanged - skip the remove/re-add, this runs on every line change and again before payment
            if (surcharge.listPrice === -amountDiscount) continue
            surcharge.listPrice = -amountDiscount
            await this.removeSurchargeFromOrder(ctx, order.id, surcharge.id)
            // removeSurchargeFromOrder returns the order as loaded before the surcharge row is deleted,
            // pricing that object again would put the removed voucher back into the totals
            addSurchargeResult = (await this.findOne(ctx, order.id)) ?? addSurchargeResult
            const surchargeNew = {
                description: surcharge.description,
                sku: surcharge.sku,
                id: surcharge.id,
                listPrice: surcharge.listPrice, // Replace with the surcharge amount
                listPriceIncludesTax: surcharge.listPriceIncludesTax,
            }
            if (surchargeNew.listPrice < 0) addSurchargeResult = await this.addSurchargeToOrder(ctx, order.id, surchargeNew)
            addSurchargeResult = await this.applyPriceAdjustments(ctx, addSurchargeResult)
        }
        return { order: addSurchargeResult, notices }
    }
    async removeOrderLine(ctx: RequestContext, orderId: ID, orderLineId: ID) {
        const result = await super.removeItemFromOrder(ctx, orderId, orderLineId)
        return this.afterOrderLinesChanged(ctx, orderId, result)
    }
    /**
     * Returns `null` when the code buys nothing on this cart (empty, only voucher products, or already covered by
     * other vouchers), so the resolver can tell the customer instead of handing back the unchanged order.
     */
    async applyCouponCodeCustom(ctx: RequestContext, order: Order, coupon: any): Promise<Order | null> {
        return this.doSurchargersCoupon(ctx, order, coupon)
    }
    async removeCouponCodeCustom(ctx: RequestContext, order: Order, coupon: { code: string }): Promise<Order> {
        return this.removeCouponCode(ctx, order.id, coupon.code)
    }
    async doSurchargersCoupon(ctx: RequestContext, order: Order, coupon: any, add: boolean = true): Promise<Order | null> {
        const surcharges = await this.getOrderSurcharges(ctx, order.id)
        let addSurchargeResult: Order | ErrorResultUnion<UpdateOrderItemsResult, Order> | null = null

        const surcharge = surcharges.find((surcharge) => surcharge.sku === couponSku(coupon.code))

        if (surcharge && !add) {
            addSurchargeResult = await this.removeSurchargeFromOrder(ctx, order.id, surcharge.id)
            addSurchargeResult = await this.applyPriceAdjustments(ctx, addSurchargeResult)
        } else if (!add) {
            addSurchargeResult = order
        } else {
            const realProductPrice = this.getRealProductPriceForVouchers(order, coupon.code)
            Logger.debug(`doSurchargersCoupon ${coupon.code}: realProductPrice ${realProductPrice}`, loggerCtx)

            const amountDiscount = coupon.amount > realProductPrice ? realProductPrice : coupon.amount
            // nothing left for the voucher to pay for - the resolver turns this into an error message
            if (amountDiscount <= 0) return null

            const surchargeNew = {
                description: `Gutscheincode | ${coupon.code}`,
                sku: couponSku(coupon.code),
                id: surcharge?.id ? surcharge.id : undefined,
                listPrice: -amountDiscount, // Replace with the surcharge amount
                listPriceIncludesTax: true, // Replace with whether the list price includes tax
                // Add other missing properties here
            }
            Logger.debug("doSurchargersCoupon surchargeNew " + JSON.stringify(surchargeNew, null, 2), loggerCtx)
            addSurchargeResult = await this.addSurchargeToOrder(ctx, order.id, surchargeNew)
            addSurchargeResult = await this.applyPriceAdjustments(ctx, addSurchargeResult)
        }

        // Optionally, check the result of adding the surcharge
        if (addSurchargeResult instanceof Order) {
            // Return the updated order with the surcharge
            return addSurchargeResult
        } else {
            // Handle the case where adding the surcharge failed
            Logger.error("Failed to add surcharge:" + JSON.stringify(addSurchargeResult, null, 2), loggerCtx)
            // Decide how you want to handle this case. For simplicity, returning the original addItemResult.
            return order
        }
    }
    getRealProductPriceForVouchers(order: Order, currentCoupon: string = ""): number {
        let surchargeValue = order.surcharges.reduce((acc, surcharge) => {
            if (isCouponSku(surcharge.sku) && (!currentCoupon || currentCoupon !== couponCodeFromSku(surcharge.sku))) {
                acc += surcharge.listPrice
            }
            return acc
        }, 0)

        return order.lines.reduce((acc, line) => {
            if (!line.productVariant?.customFields?.isVoucher) {
                // the line total Vendure rounds once (and shows in the cart) - rounding each unit first can be a cent off
                acc += line.proratedLinePriceWithTax
            }
            return acc
        }, surchargeValue)
    }
    /**
     * Do not use core `removeCouponCode`: it immediately runs full `applyPriceAdjustments` and can put the
     * coupon promotion back on lines. We update `couponCodes` + history ourselves, then recalculate below.
     */
    override async removeCouponCode(ctx: RequestContext, orderId: ID, couponCode: string): Promise<Order> {
        const normalized = couponCode.trim()
        const orderForRemoval = await this.findOne(ctx, orderId, ["lines", "lines.productVariant", "lines.productVariant.productVariantPrices", "shippingLines", "surcharges", "customer"])
        if (!orderForRemoval) {
            throw new EntityNotFoundError("Order", orderId)
        }
        const surcharges = await this.getOrderSurcharges(ctx, orderId)
        const surcharge = surcharges.find((s) => s.sku === couponSku(normalized)) ?? surcharges.find((s) => s.sku.toLowerCase() === couponSku(normalized).toLowerCase())
        let surchargeRemoved = false
        if (surcharge) {
            orderForRemoval.surcharges = (orderForRemoval.surcharges ?? []).filter((s) => !idsAreEqual(s.id, surcharge.id))
            await this.connectionLocal.getRepository(ctx, Surcharge).remove(surcharge)
            surchargeRemoved = true
        }
        // Match case-insensitively so callers can pass whatever the customer typed
        // even when order.couponCodes stores the promotion's canonical casing
        // (Vendure 3.7+ behavior after PR #4419).
        const normalizedLower = normalized.toLowerCase()
        const storedMatch = orderForRemoval.couponCodes.find((cc) => cc.trim().toLowerCase() === normalizedLower)
        const hadCoupon = storedMatch !== undefined
        if (hadCoupon) {
            orderForRemoval.couponCodes = orderForRemoval.couponCodes.filter((cc) => cc.trim().toLowerCase() !== normalizedLower)
            await this.historyServiceRef.createHistoryEntryForOrder({
                ctx,
                orderId: orderForRemoval.id,
                type: HistoryEntryType.ORDER_COUPON_REMOVED,
                data: { couponCode: storedMatch },
            })
            await this.eventBusRef.publish(new CouponCodeEvent(ctx, storedMatch!, orderId, "removed"))
            await this.connectionLocal.getRepository(ctx, Order).update({ id: orderForRemoval.id }, { couponCodes: orderForRemoval.couponCodes })
        }
        if (hadCoupon || surchargeRemoved) {
            return this.finalizeOrderPricingAfterCouponRemoval(ctx, orderId, hadCoupon ? storedMatch! : null)
        }
        const fallback = await this.findOne(ctx, orderId, ["lines", "lines.productVariant", "lines.productVariant.taxCategory", "surcharges", "shippingLines"])
        if (!fallback) {
            throw new EntityNotFoundError("Order", orderId)
        }
        return fallback
    }
    private async finalizeOrderPricingAfterCouponRemoval(ctx: RequestContext, orderId: ID, removedCouponCode: string | null): Promise<Order> {
        const order = await this.findOne(ctx, orderId, ["lines", "lines.productVariant", "lines.productVariant.taxCategory", "surcharges", "shippingLines"])
        if (!order) {
            throw new Error(`Order ${String(orderId)} not found after coupon removal`)
        }

        const activePromotionsPre = await this.promotionServiceDirect.getActivePromotionsOnOrder(ctx, order.id)
        const shippingLineIdsPre = order.shippingLines.map((l) => l.id)
        const updatedOrder = await this.applyPriceAdjustmentsForCouponRemoval(ctx, order, removedCouponCode)
        const shippingLineIdsPost = updatedOrder.shippingLines.map((l) => l.id)

        await this.syncShippingLineRelations(ctx, updatedOrder, shippingLineIdsPre, shippingLineIdsPost)

        await this.connectionLocal.getRepository(ctx, Order).save(omit(updatedOrder, ["shippingAddress", "billingAddress", "lines", "shippingLines", "aggregateOrder", "sellerOrders", "customer", "modifications", "customFields"]), { reload: false })
        await this.promotionServiceDirect.runPromotionSideEffects(ctx, updatedOrder, activePromotionsPre)
        await this.connectionLocal.getRepository(ctx, OrderLine).save(updatedOrder.lines, { reload: false })
        await this.connectionLocal.getRepository(ctx, ShippingLine).save(updatedOrder.shippingLines, { reload: false })

        const result = await this.findOne(ctx, orderId, ["lines", "lines.productVariant", "lines.productVariant.taxCategory", "surcharges", "shippingLines"])
        if (!result) {
            throw new Error(`Order ${String(orderId)} not found after finalize`)
        }
        return result
    }
    /**
     * Channel promotions minus the one tied to `removedCouponCode` (by `promotion.couponCode`).
     * If nothing remains to apply, clear line adjustments and run a second pricing pass with shipping skipped:
     * a single pass can leave stale promotion rows on lines until after shipping.
     */
    private async applyPriceAdjustmentsForCouponRemoval(ctx: RequestContext, order: Order, removedCouponCode: string | null): Promise<Order> {
        const all = await this.promotionServiceDirect.getActivePromotionsInChannel(ctx)
        const removedUpper = removedCouponCode?.trim().toUpperCase() ?? ""
        const promotions = removedUpper.length > 0 ? all.filter((p) => (p.couponCode ?? "").trim().toUpperCase() !== removedUpper) : all

        let updated = await this.orderCalculatorDirect.applyPriceAdjustments(ctx, order, promotions, [])
        if (promotions.length === 0) {
            for (const line of updated.lines) {
                line.clearAdjustments()
            }
            this.orderCalculatorDirect.calculateOrderTotals(updated)
            updated = await this.orderCalculatorDirect.applyPriceAdjustments(ctx, updated, [], [], {
                recalculateShipping: false,
            })
        }
        return updated
    }

    private async syncShippingLineRelations(ctx: RequestContext, order: Order, shippingLineIdsPre: ID[], shippingLineIdsPost: ID[]): Promise<void> {
        const removed = shippingLineIdsPre.filter((id) => !shippingLineIdsPost.includes(id))
        const added = shippingLineIdsPost.filter((id) => !shippingLineIdsPre.includes(id))
        for (const idToRemove of removed) {
            await this.connectionLocal.getRepository(ctx, Order).createQueryBuilder().relation("shippingLines").of(order).remove(idToRemove)
        }
        for (const idToAdd of added) {
            await this.connectionLocal.getRepository(ctx, Order).createQueryBuilder().relation("shippingLines").of(order).add(idToAdd)
        }
    }

    async recalcAfterPaymentMethodChange(ctx: RequestContext, orderId: ID): Promise<Order> {
        const order = await this.findOne(ctx, orderId, ["lines", "lines.productVariant", "lines.productVariant.taxCategory", "surcharges", "shippingLines", "customer"])
        if (!order) {
            throw new EntityNotFoundError("Order", orderId)
        }
        const activePromotionsPre = await this.promotionServiceDirect.getActivePromotionsOnOrder(ctx, order.id)
        const shippingLineIdsPre = order.shippingLines.map((l) => l.id)

        const promotions = await this.promotionServiceDirect.getActivePromotionsInChannel(ctx)
        for (const line of order.lines) {
            line.clearAdjustments()
        }
        let updated = await this.orderCalculatorDirect.applyPriceAdjustments(ctx, order, promotions, [])
        for (const line of updated.lines) {
            line.clearAdjustments()
        }
        this.orderCalculatorDirect.calculateOrderTotals(updated)
        updated = await this.orderCalculatorDirect.applyPriceAdjustments(ctx, updated, promotions, [], {
            recalculateShipping: false,
        })

        const shippingLineIdsPost = updated.shippingLines.map((l) => l.id)
        await this.syncShippingLineRelations(ctx, updated, shippingLineIdsPre, shippingLineIdsPost)
        await this.connectionLocal.getRepository(ctx, Order).save(omit(updated, ["shippingAddress", "billingAddress", "lines", "shippingLines", "aggregateOrder", "sellerOrders", "customer", "modifications", "customFields"]), { reload: false })
        await this.promotionServiceDirect.runPromotionSideEffects(ctx, updated, activePromotionsPre)
        await this.connectionLocal.getRepository(ctx, OrderLine).save(updated.lines, { reload: false })
        await this.connectionLocal.getRepository(ctx, ShippingLine).save(updated.shippingLines, { reload: false })

        const result = await this.findOne(ctx, orderId, ["lines", "lines.productVariant", "lines.productVariant.taxCategory", "surcharges", "shippingLines"])
        if (!result) {
            throw new EntityNotFoundError("Order", orderId)
        }
        return result
    }

    /**
     * Raises the withdrawal counter of an order by one. Called by the shop after the withdrawal
     * form of an order was successfully submitted, so the account page can show that the form
     * already went out and the admin sees the request on the order.
     */
    async incrementOrderWithdrawalCount(ctx: RequestContext, orderCode: string): Promise<number> {
        const activeUserId = ctx.activeUserId
        if (!activeUserId) {
            throw new ForbiddenError()
        }

        const order = await this.connectionLocal.getRepository(ctx, Order).findOne({
            where: { code: orderCode },
            relations: ["customer", "customer.user"],
        })
        if (!order) {
            throw new EntityNotFoundError("Order", orderCode)
        }

        // the order code travels through the form as a plain query parameter, so a foreign one must never be writable
        const ownerUserId = order.customer?.user?.id
        if (!ownerUserId || !idsAreEqual(ownerUserId, activeUserId)) {
            throw new ForbiddenError()
        }

        const withdrawalCount = (order.customFields?.withdrawalCount ?? 0) + 1
        await this.updateCustomFields(ctx, order.id, { withdrawalCount })

        return withdrawalCount
    }
}
