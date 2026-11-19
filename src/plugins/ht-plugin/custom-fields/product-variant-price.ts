import { CustomFieldConfig, LanguageCode } from "@vendure/core"

export const productVariantPriceReferencePrice: CustomFieldConfig = {
    type: "int",
    name: "referencePrice",
    ui: { component: "currency-form-input" },
    label: [
        { languageCode: LanguageCode.de, value: "Originalpreis (wenn Rabatt)" },
        { languageCode: LanguageCode.en, value: "Original price (if discounted)" },
        { languageCode: LanguageCode.it, value: "Prezzo originale (se scontato)" },
    ],
    public: true,
}