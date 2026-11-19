import { CustomFieldConfig, LanguageCode, Product } from "@vendure/core"

export const productShortDescription: CustomFieldConfig = {
    type: "localeText",
    name: "shortDescription",
    label: [
        { languageCode: LanguageCode.de, value: "Kurzbeschreibung" },
        { languageCode: LanguageCode.en, value: "Short Description" },
        { languageCode: LanguageCode.it, value: "Descrizione breve" },
    ],
    public: true,
    ui: { component: "ht-rich-text-form-input" },
}

export const productRelatedProducts: CustomFieldConfig = {
    type: "relation",
    name: "relatedProducts",
    label: [
        { languageCode: LanguageCode.de, value: "Weitere Produkte" },
        { languageCode: LanguageCode.en, value: "Related Products" },
        { languageCode: LanguageCode.it, value: "Prodotti correlati" },
    ],
    description: [
        { languageCode: LanguageCode.de, value: "Leer = Produkte aus derselben Kollektion." },
        { languageCode: LanguageCode.en, value: "Empty = products from the same collection." },
        { languageCode: LanguageCode.it, value: "Vuoto = prodotti della stessa collezione." },
    ],
    public: true,
    entity: Product,
    list: true,
    ui: { component: "related-products-form-input" },
}

export const productSold: CustomFieldConfig = {
    type: "int",
    name: "sold",
    label: [
        { languageCode: LanguageCode.de, value: "Verkaufte Stück" },
        { languageCode: LanguageCode.en, value: "Units Sold" },
        { languageCode: LanguageCode.it, value: "Unità vendute" },
    ],
    description: [
        { languageCode: LanguageCode.de, value: "Wird automatisch aus bezahlten Bestellungen hochgezählt." },
        { languageCode: LanguageCode.en, value: "Counted automatically from paid orders." },
        { languageCode: LanguageCode.it, value: "Conteggiato automaticamente dagli ordini pagati." },
    ],
    public: true,
    defaultValue: 0,
}
export const productMetaTitle: CustomFieldConfig = {
    type: "localeString",
    name: "metaTitle",
    label: [
        { languageCode: LanguageCode.de, value: "Meta-Titel" },
        { languageCode: LanguageCode.en, value: "Meta Title" },
        { languageCode: LanguageCode.it, value: "Meta titolo" },
    ],
    ui: { tab: "SEO" },
    public: true,
}

export const productMetaDescription: CustomFieldConfig = {
    type: "localeText",
    name: "metaDescription",
    label: [
        { languageCode: LanguageCode.de, value: "Meta-Beschreibung" },
        { languageCode: LanguageCode.en, value: "Meta Description" },
        { languageCode: LanguageCode.it, value: "Meta descrizione" },
    ],
    public: true,
    ui: { component: "ht-rich-text-form-input", tab: "SEO" },
}

export const productSorting: CustomFieldConfig = {
    type: "int",
    name: "sorting",
    label: [
        { languageCode: LanguageCode.de, value: "Sortierung (kleine Zahlen zuerst, 0 = ans Ende)" },
        { languageCode: LanguageCode.en, value: "Sorting (lower numbers first, 0 = at the end)" },
        { languageCode: LanguageCode.it, value: "Ordinamento (numeri bassi prima, 0 = in fondo)" },
    ],
    public: true,
    defaultValue: 0,
}

export const productUsps: CustomFieldConfig = {
    type: "localeText",
    name: "usps",
    label: [
        { languageCode: LanguageCode.de, value: "Vorteile (USPs)" },
        { languageCode: LanguageCode.en, value: "Benefits (USPs)" },
        { languageCode: LanguageCode.it, value: "Vantaggi (USP)" },
    ],
    public: true,
    ui: { component: "ht-rich-text-form-input" },
}

export const productDeliveryTime: CustomFieldConfig = {
    type: "localeString",
    name: "deliveryTime",
    label: [
        { languageCode: LanguageCode.de, value: "Voraussichtliche Lieferzeit" },
        { languageCode: LanguageCode.en, value: "Estimated delivery time" },
        { languageCode: LanguageCode.it, value: "Tempi di consegna previsti" },
    ],
    description: [
        { languageCode: LanguageCode.de, value: "z. B. \"2-3 Werktage\"" },
        { languageCode: LanguageCode.en, value: "e.g. \"2-3 working days\"" },
        { languageCode: LanguageCode.it, value: "es. \"2-3 giorni lavorativi\"" },
    ],
    public: true,
}

export const productIsDigital: CustomFieldConfig = {
    type: "boolean",
    name: "isDigital",
    label: [
        { languageCode: LanguageCode.de, value: "Digitales Produkt (kein Versand)" },
        { languageCode: LanguageCode.en, value: "Digital product (no shipping)" },
        { languageCode: LanguageCode.it, value: "Prodotto digitale (nessuna spedizione)" },
    ],
    public: true,
    defaultValue: false,
}
