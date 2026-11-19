import { CustomFieldConfig, LanguageCode } from "@vendure/core"

export const productOptionSorting: CustomFieldConfig = {
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
