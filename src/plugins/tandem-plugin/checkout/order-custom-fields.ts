import { CustomFieldConfig, LanguageCode } from "@vendure/core"

/** Free-text comment of the customer from the checkout ("Anmerkungen"). */
export const orderComment: CustomFieldConfig = {
    type: "text",
    name: "comment",
    label: [
        { languageCode: LanguageCode.de, value: "Anmerkung des Kunden" },
        { languageCode: LanguageCode.en, value: "Customer comment" },
        { languageCode: LanguageCode.it, value: "Nota del cliente" },
    ],
    public: true,
    nullable: true,
    validate: (value: any) => {
        if (typeof value === "string" && value.length > 2000) {
            return [
                { languageCode: LanguageCode.de, value: "Die Anmerkung darf höchstens 2000 Zeichen lang sein" },
                { languageCode: LanguageCode.en, value: "The comment must not exceed 2000 characters" },
                { languageCode: LanguageCode.it, value: "La nota non può superare i 2000 caratteri" },
            ]
        }
    },
}
