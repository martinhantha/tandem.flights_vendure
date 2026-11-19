import { CustomFieldConfig, LanguageCode } from "@vendure/core"

export const addressSdi: CustomFieldConfig = {
    type: "text",
    name: "sdi",
    label: [
        { languageCode: LanguageCode.de, value: "SDI-Code" },
        { languageCode: LanguageCode.en, value: "SDI Code" },
        { languageCode: LanguageCode.it, value: "Codice SDI" },
    ],
    public: true,
}

export const addressTaxnumber: CustomFieldConfig = {
    type: "text",
    name: "taxnumber",
    label: [
        { languageCode: LanguageCode.de, value: "Steuernummer/USt-IdNr." },
        { languageCode: LanguageCode.en, value: "Tax Number/VAT ID" },
        { languageCode: LanguageCode.it, value: "Codice fiscale/P.IVA" },
    ],
    public: true,
}
