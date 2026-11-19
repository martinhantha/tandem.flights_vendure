import { LanguageCode, PromotionCondition } from "@vendure/core"

export const selectedPaymentMethodCondition = new PromotionCondition({
    code: "selected-payment-method-is",
    description: [
        {
            languageCode: LanguageCode.en,
            value: "Order is being paid with payment method { paymentMethodCode }",
        },
        {
            languageCode: LanguageCode.de,
            value: "Bestellung wird mit Zahlungsmethode { paymentMethodCode } bezahlt",
        },
        {
            languageCode: LanguageCode.it,
            value: "L'ordine viene pagato con il metodo di pagamento { paymentMethodCode }",
        },
    ],
    args: {
        paymentMethodCode: {
            type: "string",
            label: [
                { languageCode: LanguageCode.en, value: "Payment method code" },
                { languageCode: LanguageCode.de, value: "Code der Zahlungsmethode" },
                { languageCode: LanguageCode.it, value: "Codice metodo di pagamento" },
            ],
            description: [
                {
                    languageCode: LanguageCode.en,
                    value: "The PaymentMethod code, e.g. 'prepayment-bank-transfer'",
                },
            ],
        },
    },
    check: (_ctx, order, args) => {
        if (!args.paymentMethodCode) return false
        if (order.customFields?.selectedPaymentMethodCode === args.paymentMethodCode) return true
        return order.payments?.some((payment) => payment.method === args.paymentMethodCode && payment.state !== "Cancelled" && payment.state !== "Declined") ?? false
    },
})
