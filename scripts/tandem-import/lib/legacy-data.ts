import path from "path"
import { SqlDump, SqlRow } from "./sql-dump"

export type Lang = "de" | "it" | "en"
/** sys_language_uid of the old TYPO3 site: 0 = de (default), 1 = it, 2 = en */
const LANGUAGES: Record<string, Lang> = { "0": "de", "1": "it", "2": "en" }
export const LANGS: Lang[] = ["de", "it", "en"]

export interface LegacyProduct {
    uid: number
    /** the old external product id (`id` column), referenced by tx_extshop_domain_model_coupon.productid */
    legacyId: string
    sku: string
    enabled: boolean
    /** gross price in EUR */
    price: number
    name: Record<Lang, string>
    shortDescription: Record<Lang, string>
    description: Record<Lang, string>
    /** basename of the title image in the old fileadmin, e.g. "Tandemflug_Reinswald.JPG" */
    titleImage: string | null
}

export interface LegacyCoupon {
    code: string
    /** old external product id or "" for vouchers created by hand in the TYPO3 backend */
    productId: string
    orderId: string
    nthProduct: number
    used: boolean
    createdAt: Date
    expiresAt: Date
    /** free text of the old "price" field, e.g. "110 €" */
    priceText: string
    /** PERSONAL DATA (recipient / customer name) - store in the DB only, never print */
    info: string
    /** PERSONAL DATA (staff member who issued the voucher) - store in the DB only, never print */
    issuer: string
}

export function decodeHtml(value: string): string {
    return value
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<[^>]+>/g, "")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, '"')
        .replace(/&#0?39;|&apos;/g, "'")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/[ \t]+/g, " ")
        .trim()
}

function cleanHtml(value: string | null): string {
    return (value ?? "")
        .replace(/&nbsp;/g, " ")
        .replace(/\r\n/g, "\n")
        .replace(/<p>\s*<\/p>/g, "")
        .trim()
}

function titleCase(value: string): string {
    return value
        .split(" ")
        .map((word) => (["and", "und", "e"].includes(word.toLowerCase()) ? word.toLowerCase() : word.charAt(0).toUpperCase() + word.slice(1)))
        .join(" ")
}

/** "für Einsteiger und Genießer - Easy flight" -> { prefix: "für Einsteiger und Genießer", suffix: "Easy Flight" } */
function splitName(name: string): { prefix: string; suffix: string } | null {
    const index = name.lastIndexOf(" - ")
    if (index < 0) return null
    return { prefix: name.slice(0, index).trim(), suffix: titleCase(name.slice(index + 3).trim()) }
}

export function readLegacyProducts(dump: SqlDump): LegacyProduct[] {
    const rows = dump.rows("tx_extshop_domain_model_product").filter((row) => row.deleted === "0")
    const images = readTitleImages(dump)
    const bases = rows.filter((row) => row.sys_language_uid === "0" && row.l10n_parent === "0")
    const usedSkus = new Set<string>()

    return bases.map((base) => {
        const translations: Partial<Record<Lang, SqlRow>> = { de: base }
        for (const row of rows) {
            const lang = LANGUAGES[row.sys_language_uid ?? ""]
            if (row.l10n_parent === base.uid && lang && lang !== "de") translations[lang] = row
        }

        const deName = decodeHtml(base.name ?? "")
        const deSplit = splitName(deName)
        const name = {} as Record<Lang, string>
        const shortDescription = {} as Record<Lang, string>
        const description = {} as Record<Lang, string>
        for (const lang of LANGS) {
            const row = translations[lang] ?? base
            const full = decodeHtml(row.name ?? "")
            const split = splitName(full)
            if (!deSplit) {
                // e.g. "1 Eagle flight + 2 x Marende": no tagline; the it/en rows of these (hidden) products are
                // copies of other products in the old DB, so the German name is used for all languages
                name[lang] = deName
                shortDescription[lang] = ""
            } else if (split) {
                name[lang] = split.suffix
                shortDescription[lang] = split.prefix
            } else {
                // e.g. en "for beginners and for everyone who simply wants to enjoy and relax" (no " - Easy flight")
                name[lang] = deSplit.suffix
                shortDescription[lang] = full
            }
            description[lang] = cleanHtml(row.description) || cleanHtml(row.descriptionshort)
        }

        let sku = (base.sku ?? "").trim() || `td-${base.uid}`
        for (let suffix = "b".charCodeAt(0); usedSkus.has(sku); suffix++) {
            // uid 16 ("Eagle flight + 2 x Marende") reuses td005 of the breakfast flight
            sku = `${(base.sku ?? "").trim()}${String.fromCharCode(suffix)}`
        }
        usedSkus.add(sku)

        return {
            uid: Number(base.uid),
            legacyId: (base.id ?? "").trim(),
            sku,
            enabled: base.hidden === "0",
            price: Number(base.price),
            name,
            shortDescription,
            description,
            titleImage: images.get(base.uid ?? "") ?? null,
        }
    })
}

function readTitleImages(dump: SqlDump): Map<string, string> {
    const files = new Map(dump.rows("sys_file").map((file) => [file.uid ?? "", file.identifier ?? ""]))
    const result = new Map<string, string>()
    for (const ref of dump.rows("sys_file_reference")) {
        if (ref.tablenames !== "tx_extshop_domain_model_product" || ref.fieldname !== "titleimage" || ref.deleted !== "0" || ref.hidden !== "0") continue
        const identifier = files.get(ref.uid_local ?? "")
        if (identifier && !result.has(ref.uid_foreign ?? "")) result.set(ref.uid_foreign ?? "", path.basename(identifier))
    }
    return result
}

/** Name under which a legacy image is expected in scripts/tandem-import/assets/products (ascii, lower case). */
export function normalizeAssetFilename(filename: string): string {
    const ext = path.extname(filename).toLowerCase()
    const base = path
        .basename(filename, path.extname(filename))
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/ß/g, "ss")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
    return base + ext
}

export function readLegacyCoupons(dump: SqlDump): LegacyCoupon[] {
    return dump
        .rows("tx_extshop_domain_model_coupon")
        .filter((row) => row.deleted === "0" && (row.couponid ?? "").trim() !== "")
        .map((row) => ({
            code: (row.couponid ?? "").trim(),
            productId: (row.productid ?? "").trim(),
            orderId: (row.orderid ?? "").trim(),
            nthProduct: Number(row.nthproduct ?? 0),
            used: row.used === "1",
            createdAt: new Date(Number(row.crdate) * 1000),
            expiresAt: new Date(Number(row.expiredate) * 1000),
            priceText: (row.price ?? "").trim(),
            info: decodeHtml(row.info ?? ""),
            issuer: (row.user ?? "").trim(),
        }))
}

/** "110 €", "110€", "110", "Noch zu bezahlen 140 €" -> cents; "", "Gratis", "0" -> null (value unknown) */
export function parsePriceText(text: string): number | null {
    const match = text.replace(",", ".").match(/\d+(\.\d{1,2})?/)
    if (!match) return null
    const cents = Math.round(parseFloat(match[0]) * 100)
    return cents > 0 ? cents : null
}

/** old external product id (`id` column) -> sku, see TANDEM.md */
export const LEGACY_PRODUCT_ID_TO_SKU: Record<string, string> = {
    "1": "td001",
    "2": "td002",
    "3": "td003",
    "4": "td004",
    "5": "td005",
    "7": "td007",
}
