import { CustomFieldConfig, LanguageCode } from "@vendure/core"

export const facetFilter: CustomFieldConfig = {
    type: "boolean",
    name: "filter",
    label: [
        { languageCode: LanguageCode.de, value: "Für Filter aktiv" },
        { languageCode: LanguageCode.en, value: "Active for Filter" },
        { languageCode: LanguageCode.it, value: "Attivo per filtro" },
    ],
    defaultValue: true,
    public: true,
}

export const facetSorting: CustomFieldConfig = {
    type: "int",
    name: "sorting",
    label: [
        { languageCode: LanguageCode.de, value: "Sortierung" },
        { languageCode: LanguageCode.en, value: "Sorting" },
        { languageCode: LanguageCode.it, value: "Ordinamento" },
    ],
    defaultValue: 0,
    public: true,
}
