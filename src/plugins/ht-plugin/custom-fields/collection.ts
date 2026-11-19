import { CustomFieldConfig, LanguageCode } from "@vendure/core"

export const collectionMetaTitle: CustomFieldConfig = {
    type: "localeString",
    name: "metaTitle",
    label: [
        { languageCode: LanguageCode.de, value: "Meta-Titel" },
        { languageCode: LanguageCode.en, value: "Meta Title" },
        { languageCode: LanguageCode.it, value: "Meta titolo" },
    ],
    public: true,
}

export const collectionMetaDescription: CustomFieldConfig = {
    type: "localeText",
    name: "metaDescription",
    label: [
        { languageCode: LanguageCode.de, value: "Meta-Beschreibung" },
        { languageCode: LanguageCode.en, value: "Meta Description" },
        { languageCode: LanguageCode.it, value: "Meta descrizione" },
    ],
    public: true,
    ui: { component: "ht-rich-text-form-input" },
}
export const collectionIsProductVariantsOverview: CustomFieldConfig = {
    type: "boolean",
    name: "isProductVariantsOverview",
    label: [
        { languageCode: LanguageCode.de, value: "Produktvarianten Übersicht" },
        { languageCode: LanguageCode.en, value: "Product Variants Overview" },
        { languageCode: LanguageCode.it, value: "Panoramica varianti prodotto" },
    ],
    defaultValue: false,
    public: true,
}
