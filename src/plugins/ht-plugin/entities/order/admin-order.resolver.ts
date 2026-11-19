import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { Permission } from "@vendure/common/lib/generated-shop-types"
import { Allow, Ctx, EventBus, LanguageCode, Logger, OrderService, Payment, RequestContext, TransactionalConnection } from "@vendure/core"
import { CustomOrderConfirmationEvent } from "../../event/custom-order-configuration-event"
import { SEPA_DD_PAYMENT_CODE } from "../../handler/sepa-dd-payment-handler"
import { decryptField } from "../../util/field-crypto"

const loggerCtx = "OverrideAdminOrderResolver"

@Resolver()
export class OverrideAdminOrderResolver {
    constructor(
        private orderService: OrderService,
        private eventBus: EventBus,
        private connection: TransactionalConnection,
    ) {}

    @Mutation()
    @Allow(Permission.ReadOrder)
    async revealSepaDetails(@Ctx() ctx: RequestContext, @Args() args: { paymentId: string }) {
        // the order relation is only needed for the audit log below
        const payment = await this.connection.getRepository(ctx, Payment).findOne({ where: { id: args.paymentId }, relations: ["order"] })
        if (!payment) {
            throw new Error(`Payment ${args.paymentId} not found`)
        }
        if (payment.method !== SEPA_DD_PAYMENT_CODE) {
            throw new Error(`Payment ${args.paymentId} is not a ${SEPA_DD_PAYMENT_CODE} payment`)
        }
        const metadata = (payment.metadata ?? {}) as Record<string, any>
        const accountHolderEnc = metadata.accountHolderEnc as string | undefined
        const ibanEnc = metadata.ibanEnc as string | undefined
        const pub = (metadata.public ?? {}) as Record<string, any>

        if (!accountHolderEnc || !ibanEnc) {
            throw new Error("Encrypted SEPA fields missing on payment metadata")
        }

        Logger.info(`SEPA reveal: payment=${payment.id} order=${payment.order?.id ?? "?"} admin=${ctx.activeUserId ?? "?"}`, "SepaReveal")

        return {
            accountHolder: decryptField(accountHolderEnc),
            iban: decryptField(ibanEnc),
            bic: pub.bic ?? "",
            bankName: pub.bankName ?? "",
            mandateReference: pub.mandateReference ?? "",
        }
    }

    @Mutation()
    @Allow(Permission.UpdateOrder, Permission.Owner)
    async resendOrderEmail(@Ctx() ctx: RequestContext, args: any): Promise<boolean> {
        try {
            Logger.debug("resendOrderEmail " + ctx.req?.body.variables.orderId, loggerCtx)
            Logger.debug("resendOrderEmail " + ctx.req?.body.variables.email, loggerCtx)

            const email = ctx.req?.body.variables.email

            // Set the language of the RequestContext

            const order = await this.orderService.findOne(ctx, ctx.req?.body.variables.orderId)
            Logger.debug("resendOrderEmail languageCode " + (<any>order?.customFields)?.languageCode, loggerCtx)
            const ctxLang = new RequestContext({
                req: ctx.req,
                apiType: ctx.apiType,
                channel: ctx.channel,
                session: ctx.session,
                isAuthorized: ctx.isAuthorized,
                authorizedAsOwnerOnly: ctx.authorizedAsOwnerOnly,
                languageCode: <LanguageCode>(<any>order?.customFields)?.languageCode || ctx.languageCode,
            })
            if (!order) {
                // args is not bound with @Args(), the order id only comes through ctx.req
                throw new Error(`Order with ID ${ctx.req?.body.variables.orderId} not found`)
            }
            Logger.debug("resendOrderEmail " + order.id, loggerCtx)
            this.eventBus.publish(new CustomOrderConfirmationEvent(ctxLang, order, email))

            return true
        } catch (error) {
            Logger.error("resendOrderEmail " + error, loggerCtx)
            return false
        }
    }
}
