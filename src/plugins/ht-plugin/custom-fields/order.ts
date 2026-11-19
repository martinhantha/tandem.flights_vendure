import { CustomFieldConfig, LanguageCode } from "@vendure/core"

export const orderLanguageCode: CustomFieldConfig = {
    type: "string",
    name: "languageCode",
    label: [
        { languageCode: LanguageCode.de, value: "Sprache" },
        { languageCode: LanguageCode.en, value: "Language" },
        { languageCode: LanguageCode.it, value: "Lingua" },
    ],
    public: true,
    nullable: true,
    validate: (value: any) => {
        if (!value || (typeof value === "string" && value.trim() === "")) {
            return [
                { languageCode: LanguageCode.de, value: "Sprache ist erforderlich" },
                { languageCode: LanguageCode.en, value: "Language is required" },
                { languageCode: LanguageCode.it, value: "Lingua obbligatoria" },
            ]
        }
    },
}
export const orderIpAddress: CustomFieldConfig = {
    type: "text",
    name: "ipAddress",
    label: [
        { languageCode: LanguageCode.de, value: "IP-Adresse" },
        { languageCode: LanguageCode.en, value: "IP Address" },
        { languageCode: LanguageCode.it, value: "Indirizzo IP" },
    ],
    public: true,
    nullable: true,
}
export const orderSelectedPaymentMethodCode: CustomFieldConfig = {
    type: "string",
    name: "selectedPaymentMethodCode",
    label: [
        { languageCode: LanguageCode.de, value: "Vorausgewählte Zahlungsmethode" },
        { languageCode: LanguageCode.en, value: "Pre-selected payment method" },
        { languageCode: LanguageCode.it, value: "Metodo di pagamento preselezionato" },
    ],
    public: true,
    nullable: true,
}
export const orderWithdrawalCount: CustomFieldConfig = {
    type: "int",
    name: "withdrawalCount",
    label: [
        { languageCode: LanguageCode.de, value: "Widerrufsformulare gesendet" },
        { languageCode: LanguageCode.en, value: "Withdrawal forms sent" },
        { languageCode: LanguageCode.it, value: "Moduli di recesso inviati" },
    ],
    public: true,
    nullable: true,
    defaultValue: 0,
    readonly: true,
}
