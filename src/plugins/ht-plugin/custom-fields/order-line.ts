import { CustomFieldConfig, LanguageCode } from "@vendure/core"

export const orderLineVoucher: CustomFieldConfig = {
    type: "struct",
    name: "voucher",
    label: [
        { languageCode: LanguageCode.de, value: "Gutschein" },
        { languageCode: LanguageCode.en, value: "Voucher" },
        { languageCode: LanguageCode.it, value: "Buono" },
    ],
    public: true,
    fields: [
        { name: "lang", type: "string" },
        { name: "salutation", type: "string" },
        { name: "message", type: "string" },
        { name: "image", type: "string" },
    ],
}

export const orderLineDiscountPercent: CustomFieldConfig = {
    type: "float",
    name: "discountPercent",
    label: [
        { languageCode: LanguageCode.de, value: "Rabatt %" },
        { languageCode: LanguageCode.en, value: "Discount %" },
        { languageCode: LanguageCode.it, value: "Sconto %" },
    ],
    description: [
        { languageCode: LanguageCode.de, value: "Prozentualer Rabatt für diese Position (0-100). Wird über die Promotion \"Manueller Positionsrabatt\" angewendet." },
        { languageCode: LanguageCode.en, value: "Percentage discount for this line (0-100). Applied via the \"Manual line discount\" promotion." },
        { languageCode: LanguageCode.it, value: "Sconto percentuale per questa riga (0-100). Applicato tramite la promozione \"Sconto riga manuale\"." },
    ],
    min: 0,
    max: 100,
    defaultValue: 0,
    public: false,
    ui: { component: "number-form-input", suffix: "%", min: 0, max: 100 },
}
