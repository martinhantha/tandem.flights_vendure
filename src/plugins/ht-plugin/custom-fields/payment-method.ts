import { CustomFieldConfig, LanguageCode } from "@vendure/core"

export const paymentMethodEmailText: CustomFieldConfig = {
    type: "localeString",
    name: "emailText",
    label: [
        { languageCode: LanguageCode.de, value: "E-Mail-Text" },
        { languageCode: LanguageCode.en, value: "Email Text" },
        { languageCode: LanguageCode.it, value: "Testo email" },
    ],
    public: true,
    ui: { component: "ht-rich-text-form-input" },
}

export const paymentMethodSorting: CustomFieldConfig = {
    type: "int",
    name: "sorting",
    defaultValue: 0,
    public: true,
    label: [
        { languageCode: LanguageCode.de, value: "Sortierung" },
        { languageCode: LanguageCode.en, value: "Sort order" },
        { languageCode: LanguageCode.it, value: "Ordinamento" },
    ],
}
