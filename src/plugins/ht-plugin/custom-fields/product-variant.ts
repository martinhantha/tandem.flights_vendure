import { CustomFieldConfig, LanguageCode } from "@vendure/core"

export const productVariantNovelty: CustomFieldConfig = {
    type: "boolean",
    name: "novelty",
    defaultValue: false,
    label: [
        { languageCode: LanguageCode.de, value: "Badge \"Neuheit\" anzeigen" },
        { languageCode: LanguageCode.en, value: "Show \"New\" badge" },
        { languageCode: LanguageCode.it, value: "Mostra badge \"Novità\"" },
    ],
    public: true,
}

export const productVariantBestseller: CustomFieldConfig = {
    type: "boolean",
    name: "bestseller",
    defaultValue: false,
    label: [
        { languageCode: LanguageCode.de, value: "Badge \"Bestseller\" anzeigen" },
        { languageCode: LanguageCode.en, value: "Show \"Bestseller\" badge" },
        { languageCode: LanguageCode.it, value: "Mostra badge \"Bestseller\"" },
    ],
    public: true,
}

export const productVariantIsVoucher: CustomFieldConfig = {
    type: "boolean",
    name: "isVoucher",
    defaultValue: false,
    label: [
        { languageCode: LanguageCode.de, value: "Als Gutschein verkaufen" },
        { languageCode: LanguageCode.en, value: "Sell as voucher" },
        { languageCode: LanguageCode.it, value: "Vendi come buono" },
    ],
    description: [
        { languageCode: LanguageCode.de, value: "Nach Zahlungseingang wird pro Stück ein Gutschein-PDF mit Code erzeugt und an die Bestellbestätigung angehängt." },
        { languageCode: LanguageCode.en, value: "Once payment is received, a voucher PDF with code is generated per unit and attached to the order confirmation." },
        { languageCode: LanguageCode.it, value: "Dopo il pagamento viene generato un PDF del buono con codice per ogni unità e allegato alla conferma d'ordine." },
    ],
    public: true,
}

export const productVariantHiddenInOverview: CustomFieldConfig = {
    type: "boolean",
    name: "hiddenInOverview",
    defaultValue: false,
    label: [
        { languageCode: LanguageCode.de, value: "In Produktübersicht ausblenden" },
        { languageCode: LanguageCode.en, value: "Hide in product overview" },
        { languageCode: LanguageCode.it, value: "Nascondi nella panoramica prodotti" },
    ],
    public: true,
}

export const productVariantSold: CustomFieldConfig = {
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

export const productVariantSorting: CustomFieldConfig = {
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

export const productVariantAvailabilityInfoText: CustomFieldConfig = {
    type: "localeText",
    name: "availabilityInfoText",
    label: [
        { languageCode: LanguageCode.de, value: "Zusatzhinweis, wann wieder lieferbar" },
        { languageCode: LanguageCode.en, value: "Note on when back in stock" },
        { languageCode: LanguageCode.it, value: "Nota su quando torna disponibile" },
    ],
    description: [
        { languageCode: LanguageCode.de, value: "Wird nur bei ausverkauften Artikeln auf der Produktdetailseite hinter \"Ausverkauft!\" angezeigt, z. B. \"Wieder lieferbar ab KW 12\"." },
        { languageCode: LanguageCode.en, value: "Only shown for sold-out items on the product detail page after \"Sold out!\", e.g. \"Back in stock from week 12\"." },
        { languageCode: LanguageCode.it, value: "Mostrato solo per articoli esauriti nella pagina prodotto dopo \"Esaurito!\", es. \"Di nuovo disponibile dalla settimana 12\"." },
    ],
    public: true,
}

export const productVariantLowStockThreshold: CustomFieldConfig = {
    type: "int",
    name: "lowStockThreshold",
    nullable: true,
    label: [
        { languageCode: LanguageCode.de, value: "Meldebestand (leer = globaler Wert, 0 = aus)" },
        { languageCode: LanguageCode.en, value: "Low stock threshold (empty = global value, 0 = off)" },
        { languageCode: LanguageCode.it, value: "Soglia scorte basse (vuoto = valore globale, 0 = off)" },
    ],
    description: [
        { languageCode: LanguageCode.de, value: "Warn-E-Mail wird versendet, sobald der verfügbare Bestand auf diesen Wert fällt." },
        { languageCode: LanguageCode.en, value: "Alert email is sent once the available stock drops to this value." },
        { languageCode: LanguageCode.it, value: "L'email di avviso viene inviata quando lo stock disponibile scende a questo valore." },
    ],
    public: false,
}
