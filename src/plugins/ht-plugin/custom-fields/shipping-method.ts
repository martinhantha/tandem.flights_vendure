import { CustomFieldConfig, LanguageCode } from "@vendure/core"

export const shippingMethodSorting: CustomFieldConfig = {
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
