import { CustomFieldConfig, LanguageCode } from "@vendure/core"

export const customerMarketing: CustomFieldConfig = {
    type: "boolean",
    name: "marketing",
    label: [
        { languageCode: LanguageCode.de, value: "Einwilligung Marketing" },
        { languageCode: LanguageCode.en, value: "Marketing Consent" },
        { languageCode: LanguageCode.it, value: "Consenso marketing" },
    ],
    public: true,
}

export const customerIsBusiness: CustomFieldConfig = {
    type: "boolean",
    name: "isBusiness",
    label: [
        { languageCode: LanguageCode.de, value: "Ist Geschäftskunde" },
        { languageCode: LanguageCode.en, value: "Is Business" },
        { languageCode: LanguageCode.it, value: "È azienda" },
    ],
    public: true,
}

export const customerExtendedInfo: CustomFieldConfig = {
    type: "text",
    name: "extendedInfo",
    label: [
        { languageCode: LanguageCode.de, value: "Benutzerdefinierte Info (JSON)" },
        { languageCode: LanguageCode.en, value: "Custom Info (JSON)" },
        { languageCode: LanguageCode.it, value: "Info personalizzate (JSON)" },
    ],
    public: true,
}

export const customerPreferredLanguage: CustomFieldConfig = {
    type: "string",
    name: "preferredLanguage",
    label: [
        { languageCode: LanguageCode.de, value: "Bevorzugte Sprache" },
        { languageCode: LanguageCode.en, value: "Preferred Language" },
        { languageCode: LanguageCode.it, value: "Lingua preferita" },
    ],
    options: [
        {
            value: "de",
            label: [
                { languageCode: LanguageCode.de, value: "Deutsch" },
                { languageCode: LanguageCode.en, value: "German" },
                { languageCode: LanguageCode.it, value: "Tedesco" },
            ],
        },
        {
            value: "it",
            label: [
                { languageCode: LanguageCode.de, value: "Italienisch" },
                { languageCode: LanguageCode.en, value: "Italian" },
                { languageCode: LanguageCode.it, value: "Italiano" },
            ],
        },
        {
            value: "en",
            label: [
                { languageCode: LanguageCode.de, value: "Englisch" },
                { languageCode: LanguageCode.en, value: "English" },
                { languageCode: LanguageCode.it, value: "Inglese" },
            ],
        },
    ],
    public: true,
    nullable: true,
}
