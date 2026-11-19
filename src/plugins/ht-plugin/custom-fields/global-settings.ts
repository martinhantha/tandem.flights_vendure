import { CustomFieldConfig, LanguageCode } from "@vendure/core"

export const globalSettingsOrderEmailCopyTo: CustomFieldConfig = {
    type: "string",
    name: "orderEmailCopyTo",
    label: [
        { languageCode: LanguageCode.de, value: "Bestell-E-Mail Kopie an (mehrere E-Mails mit Komma getrennt)" },
        { languageCode: LanguageCode.en, value: "Order Email Copy To (multiple emails separated by comma)" },
        { languageCode: LanguageCode.it, value: "Copia email ordine a (più email separate da virgola)" },
    ],
    requiresPermission: ["CreateSettings"],
    public: true,
}

export const globalSettingsLowStockEmailTo: CustomFieldConfig = {
    type: "string",
    name: "lowStockEmailTo",
    label: [
        { languageCode: LanguageCode.de, value: "Lagerbestand-Warnung an (mehrere E-Mails mit Komma getrennt)" },
        { languageCode: LanguageCode.en, value: "Low stock alert to (multiple emails separated by comma)" },
        { languageCode: LanguageCode.it, value: "Avviso scorte basse a (più email separate da virgola)" },
    ],
    requiresPermission: ["CreateSettings"],
    public: false,
}

export const globalSettingsLowStockThreshold: CustomFieldConfig = {
    type: "int",
    name: "lowStockThreshold",
    defaultValue: 0,
    label: [
        { languageCode: LanguageCode.de, value: "Globaler Meldebestand (0 = aus, pro Variante überschreibbar)" },
        { languageCode: LanguageCode.en, value: "Global low stock threshold (0 = off, can be overridden per variant)" },
        { languageCode: LanguageCode.it, value: "Soglia scorte globale (0 = off, sovrascrivibile per variante)" },
    ],
    requiresPermission: ["CreateSettings"],
    public: false,
}
