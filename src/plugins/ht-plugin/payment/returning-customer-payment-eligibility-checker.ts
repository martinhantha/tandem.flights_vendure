import { LanguageCode, Order, OrderState, PaymentMethodEligibilityChecker, RequestContext, TransactionalConnection } from "@vendure/core"

let connection: TransactionalConnection

const COMPLETED_STATES: OrderState[] = ["PaymentSettled"] // "PartiallyShipped", "Shipped", "PartiallyDelivered", "Delivered"

export const returningCustomerPaymentEligibilityChecker = new PaymentMethodEligibilityChecker({
    init: (injector) => {
        connection = injector.get(TransactionalConnection)
    },
    code: "returning-customer-payment-eligibility-checker",
    description: [
        {
            languageCode: LanguageCode.de,
            value: "Nur für Kunden mit mindestens einer abgeschlossenen Bestellung",
        },
        {
            languageCode: LanguageCode.en,
            value: "Only for customers with at least one completed order",
        },
        {
            languageCode: LanguageCode.it,
            value: "Solo per clienti con almeno un ordine completato",
        },
    ],
    args: {},
    check: async (ctx: RequestContext, order): Promise<boolean> => {
        const customerId = order.customer?.id
        if (!customerId) {
            return false
        }

        const count = await connection.getRepository(ctx, Order).createQueryBuilder("order").where("order.customerId = :customerId", { customerId }).andWhere("order.id != :orderId", { orderId: order.id }).andWhere("order.state IN (:...states)", { states: COMPLETED_STATES }).getCount()

        return count > 0
    },
})
