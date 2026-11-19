import { CustomFieldConfig, LanguageCode } from "@vendure/core"

export const facetValueDisplayName: CustomFieldConfig = {
    type: "localeString",
    name: "displayName",
    label: [
        { languageCode: LanguageCode.de, value: "Anzeigename" },
        { languageCode: LanguageCode.en, value: "Display Name" },
        { languageCode: LanguageCode.it, value: "Nome visualizzato" },
    ],
    public: true,
}

export const facetValueFilterableInList: CustomFieldConfig = {
    type: "boolean",
    name: "filter",
    label: [
        { languageCode: LanguageCode.de, value: "Filterbar in der Liste / Produktübersicht" },
        { languageCode: LanguageCode.en, value: "Filterable in List / Product Overview" },
        { languageCode: LanguageCode.it, value: "Filtrabile nella lista / Panoramica prodotti" },
    ],
    defaultValue: true,
    public: true,
}

export const facetValueSorting: CustomFieldConfig = {
    type: "int",
    name: "sorting",
    label: [
        { languageCode: LanguageCode.de, value: "Position" },
        { languageCode: LanguageCode.en, value: "Position" },
        { languageCode: LanguageCode.it, value: "Posizione" },
    ],
    defaultValue: 0,
    public: true,
}
