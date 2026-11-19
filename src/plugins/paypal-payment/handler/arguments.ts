import { ConfigArgs } from "@vendure/core/dist/common/configurable-operation"
import { LanguageCode } from "@vendure/core"

/**
 * This Arguements create input fields for the payment handler in Vendure:
 * -> /admin/settings/payment-methods
 * Here you have the possibility to create a new payment method where you have to fill in the fields.
 */
export const paymentHandlerArguments: ConfigArgs = {
    clientId: {
        type: "string",
        label: [
            { languageCode: LanguageCode.en, value: "PayPal Client ID" },
            { languageCode: LanguageCode.it, value: "ID cliente PayPal" },
            { languageCode: LanguageCode.de, value: "PayPal Client-ID" },
        ],
        required: true,
    },
    secret: {
        type: "string",
        label: [
            { languageCode: LanguageCode.en, value: "PayPal Secret" },
            { languageCode: LanguageCode.it, value: "Secret PayPal" },
            { languageCode: LanguageCode.de, value: "PayPal-Geheimnis" },
        ],
        required: true,
    },
    sandbox: {
        type: "boolean",
        label: [
            { languageCode: LanguageCode.en, value: "Sandbox" },
            { languageCode: LanguageCode.it, value: "Sandbox" },
            { languageCode: LanguageCode.de, value: "Sandbox" },
        ],
        required: true,
        defaultValue: true,
    },
    brandName: {
        type: "string",
        label: [
            { languageCode: LanguageCode.en, value: "Brand Name" },
            { languageCode: LanguageCode.it, value: "Nome del marchio" },
            { languageCode: LanguageCode.de, value: "Markenname" },
        ],
        required: true,
        defaultValue: "My Online Shop",
    },
    cancelPath: {
        type: "string",
        label: [
            { languageCode: LanguageCode.en, value: "Cancel Path" },
            { languageCode: LanguageCode.it, value: "Percorso di annullamento" },
            { languageCode: LanguageCode.de, value: "Stornierungslink" },
        ],
        required: true,
        defaultValue: "checkout",
    },
    returnPath: {
        type: "string",
        label: [
            { languageCode: LanguageCode.en, value: "Return Path" },
            { languageCode: LanguageCode.it, value: "Percorso di ritorno" },
            { languageCode: LanguageCode.de, value: "Rückkehrpfad" },
        ],
        required: true,
        defaultValue: "checkout/success",
    },
}
