import { LanguageCode } from "@vendure/common/lib/generated-types"
import { PaymentMethodHandler } from "@vendure/core"

export const manualSettlementPaymentHandler = new PaymentMethodHandler({
    code: "manual-settlement",
    description: [
        {
            languageCode: LanguageCode.en,
            value: "Authorize only — settlement is performed manually by an administrator.",
        },
        {
            languageCode: LanguageCode.de,
            value: "Nur Autorisierung — die Freigabe erfolgt manuell durch einen Administrator.",
        },
        {
            languageCode: LanguageCode.it,
            value: "Solo autorizzazione — la conferma viene effettuata manualmente da un amministratore.",
        },
    ],
    args: {},
    createPayment: async (ctx, order, amount, args, metadata) => {
        return {
            amount,
            state: "Authorized" as const,
            transactionId: `manual-${order.code}-${Date.now()}`,
            metadata,
        }
    },
    settlePayment: async () => {
        return { success: true }
    },
    cancelPayment: async () => {
        return {
            success: true,
            metadata: { cancellationDate: new Date().toISOString() },
        }
    },
})
