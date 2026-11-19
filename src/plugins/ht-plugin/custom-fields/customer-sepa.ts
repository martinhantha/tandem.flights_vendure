import { CustomFieldConfig, LanguageCode } from "@vendure/core"

/**
 * The SEPA mandate a customer has chosen to store for reuse on later orders.
 *
 * The two `*Enc` blobs are `internal` rather than `public: false`: the latter still exposes them on
 * the Admin API, which would render the ciphertext into an editable input on the Customer detail
 * page — one stray keystroke from being undecryptable. The plaintext stays reachable per order
 * through the existing `revealSepaDetails` mutation.
 *
 * The display fields are `readonly` because they are derived from the ciphertext; editing them by
 * hand would silently desynchronise them. `readonly` only affects GraphQL input generation, so the
 * plugin's own writes are unaffected.
 */

const sepaTab = "SEPA"

export const customerSepaAccountHolderEnc: CustomFieldConfig = {
    type: "text",
    name: "sepaAccountHolderEnc",
    label: [
        { languageCode: LanguageCode.de, value: "SEPA Kontoinhaber (verschlüsselt)" },
        { languageCode: LanguageCode.en, value: "SEPA account holder (encrypted)" },
        { languageCode: LanguageCode.it, value: "SEPA intestatario (crittografato)" },
    ],
    internal: true,
    nullable: true,
}

export const customerSepaIbanEnc: CustomFieldConfig = {
    type: "text",
    name: "sepaIbanEnc",
    label: [
        { languageCode: LanguageCode.de, value: "SEPA IBAN (verschlüsselt)" },
        { languageCode: LanguageCode.en, value: "SEPA IBAN (encrypted)" },
        { languageCode: LanguageCode.it, value: "SEPA IBAN (crittografato)" },
    ],
    internal: true,
    nullable: true,
}

export const customerSepaIbanMasked: CustomFieldConfig = {
    type: "string",
    name: "sepaIbanMasked",
    label: [
        { languageCode: LanguageCode.de, value: "SEPA IBAN (maskiert)" },
        { languageCode: LanguageCode.en, value: "SEPA IBAN (masked)" },
        { languageCode: LanguageCode.it, value: "SEPA IBAN (mascherato)" },
    ],
    public: false,
    readonly: true,
    nullable: true,
    ui: { tab: sepaTab },
}

export const customerSepaIbanLast4: CustomFieldConfig = {
    type: "string",
    name: "sepaIbanLast4",
    label: [
        { languageCode: LanguageCode.de, value: "SEPA IBAN (letzte 4)" },
        { languageCode: LanguageCode.en, value: "SEPA IBAN (last 4)" },
        { languageCode: LanguageCode.it, value: "SEPA IBAN (ultime 4)" },
    ],
    public: false,
    readonly: true,
    nullable: true,
    ui: { tab: sepaTab },
}

export const customerSepaBic: CustomFieldConfig = {
    type: "string",
    name: "sepaBic",
    label: [
        { languageCode: LanguageCode.de, value: "SEPA BIC" },
        { languageCode: LanguageCode.en, value: "SEPA BIC" },
        { languageCode: LanguageCode.it, value: "SEPA BIC" },
    ],
    public: false,
    readonly: true,
    nullable: true,
    ui: { tab: sepaTab },
}

export const customerSepaBankName: CustomFieldConfig = {
    type: "string",
    name: "sepaBankName",
    label: [
        { languageCode: LanguageCode.de, value: "SEPA Bank" },
        { languageCode: LanguageCode.en, value: "SEPA bank" },
        { languageCode: LanguageCode.it, value: "SEPA banca" },
    ],
    public: false,
    readonly: true,
    nullable: true,
    ui: { tab: sepaTab },
}

export const customerSepaSavedAt: CustomFieldConfig = {
    type: "datetime",
    name: "sepaSavedAt",
    label: [
        { languageCode: LanguageCode.de, value: "SEPA Daten gespeichert am" },
        { languageCode: LanguageCode.en, value: "SEPA details saved at" },
        { languageCode: LanguageCode.it, value: "Dati SEPA salvati il" },
    ],
    public: false,
    readonly: true,
    nullable: true,
    ui: { tab: sepaTab },
}

export const customerSepaFields = [customerSepaAccountHolderEnc, customerSepaIbanEnc, customerSepaIbanMasked, customerSepaIbanLast4, customerSepaBic, customerSepaBankName, customerSepaSavedAt]
