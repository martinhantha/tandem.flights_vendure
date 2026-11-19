import { GlobalSettingsService, LanguageCode, ProductVariant } from "@vendure/core"
import { EmailEventListener } from "@vendure/email-plugin"
import i18next from "i18next"
import { getAddress } from "./order-confirmation"
import { LowStockEvent, LowStockReason } from "../event/low-stock-event"
import { applyShopPlaceholders } from "../../custom-email-plugin/utils/placeholder-utils"

// the mail is sent in all of these languages, in this order
const LANGUAGES = [LanguageCode.de, LanguageCode.it, LanguageCode.en] as const

interface CopyVars {
    name: string
    sku: string
    threshold: number
    saleable: number
    stockOnHand: number
    stockAllocated: number
}

interface Copy {
    title: Record<LowStockReason, string>
    text: Record<LowStockReason, (v: CopyVars) => string>
    info: (v: CopyVars) => string
    button: string
}

// the event fires at saleable <= threshold, so the low stock text has to cover "reached" too
const COPY: Record<(typeof LANGUAGES)[number], Copy> = {
    de: {
        title: { "out-of-stock": "Ausverkauft", "low-stock": "Niedriger Lagerbestand" },
        text: {
            "out-of-stock": (v) => `Die Variante "${v.name}" (SKU ${v.sku}) ist ausverkauft und kann nicht mehr bestellt werden.`,
            "low-stock": (v) => `Die Variante "${v.name}" (SKU ${v.sku}) hat den Meldebestand von ${v.threshold} erreicht oder unterschritten.`,
        },
        info: (v) => `Verfügbar: ${v.saleable} Stück (Lagerbestand ${v.stockOnHand}, davon ${v.stockAllocated} reserviert).`,
        button: "Variante öffnen",
    },
    it: {
        title: { "out-of-stock": "Esaurito", "low-stock": "Scorte in esaurimento" },
        text: {
            "out-of-stock": (v) => `La variante "${v.name}" (SKU ${v.sku}) è esaurita e non è più ordinabile.`,
            "low-stock": (v) => `La variante "${v.name}" (SKU ${v.sku}) ha raggiunto o è scesa sotto la scorta di ${v.threshold}.`,
        },
        info: (v) => `Disponibili: ${v.saleable} pezzi (scorta ${v.stockOnHand}, di cui ${v.stockAllocated} riservati).`,
        button: "Apri variante",
    },
    en: {
        title: { "out-of-stock": "Out of stock", "low-stock": "Low stock" },
        text: {
            "out-of-stock": (v) => `The variant "${v.name}" (SKU ${v.sku}) is out of stock and can no longer be ordered.`,
            "low-stock": (v) => `The variant "${v.name}" (SKU ${v.sku}) has reached or fallen below the low stock threshold of ${v.threshold}.`,
        },
        info: (v) => `Available: ${v.saleable} pieces (stock on hand ${v.stockOnHand}, of which ${v.stockAllocated} reserved).`,
        button: "Open variant",
    },
}

// e.g. "Ausverkauft / Esaurito / Out of stock"
function joined(pick: (copy: Copy) => string): string {
    return LANGUAGES.map((lang) => pick(COPY[lang])).join(" / ")
}

function variantName(variant: ProductVariant, languageCode: LanguageCode): string {
    return variant.translations?.find((translation) => translation.languageCode === languageCode)?.name ?? variant.name
}

// Sending a mail to the the given emails, text in german, italian and english!
export const lowStockHandler = new EmailEventListener("low-stock")
    .on(LowStockEvent)
    .loadData(async ({ event, injector }) => {
        // init services
        const settings = await injector.get(GlobalSettingsService).getSettings(event.ctx)

        // get base texts
        const shopAddress = await getAddress(event.ctx, injector, LanguageCode.de)

        return { recipient: settings.customFields.lowStockEmailTo?.trim() ?? "", shopAddress }
    })
    .setRecipient((event) => event.data.recipient)
    .setFrom("{{ mailSender }}")
    .setSubject((event) => `${joined((copy) => copy.title[event.reason])}: ${variantName(event.variant, LanguageCode.de)} (${event.variant.sku})`)
    .setTemplateVars((event) => {
        const { variant, stockOnHand, stockAllocated, threshold, reason } = event
        const languages = LANGUAGES.map((lang) => {
            const vars = { name: variantName(variant, lang), sku: variant.sku, threshold, saleable: stockOnHand - stockAllocated, stockOnHand, stockAllocated }
            return { title: COPY[lang].title[reason], text: COPY[lang].text[reason](vars), info: COPY[lang].info(vars) }
        })
        return {
            title: joined((copy) => copy.title[reason]),
            languages,
            buttonText: joined((copy) => copy.button),
            variantId: variant.id,
            footerText: applyShopPlaceholders(i18next.t("footerText", { lng: LanguageCode.de }), { _SHOP_ADDRESS_: event.data.shopAddress ?? "" }),
        }
    })
