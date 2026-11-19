export type CountryEntry = {
    code: string
    rate: number
    freeShipping: number
    taxRate: number
}

export type ShippingConfig = {
    defaultRate: number
    defaultFreeShipping: number
    defaultTaxRate: number
    countries: CountryEntry[]
}

export const EMPTY_SHIPPING_CONFIG: ShippingConfig = {
    defaultRate: 0,
    defaultFreeShipping: 0,
    defaultTaxRate: 0,
    countries: [],
}

export const EMPTY_COUNTRY_ENTRY: CountryEntry = {
    code: "",
    rate: 0,
    freeShipping: 0,
    taxRate: 0,
}

export function toInt(v: unknown): number {
    const n = typeof v === "number" ? v : parseInt(String(v ?? ""), 10)
    return Number.isFinite(n) ? Math.max(0, n) : 0
}

export function toNumber(v: unknown): number {
    if (typeof v === "number") return Number.isFinite(v) ? Math.max(0, v) : 0
    const s = String(v ?? "").replace(",", ".")
    const n = parseFloat(s)
    return Number.isFinite(n) ? Math.max(0, n) : 0
}

function normalizeCountry(c: any): CountryEntry {
    return {
        code: typeof c?.code === "string" ? c.code.toUpperCase() : "",
        rate: toInt(c?.rate),
        freeShipping: toInt(c?.freeShipping),
        taxRate: toNumber(c?.taxRate),
    }
}

export function parseShippingConfig(value: unknown): ShippingConfig {
    if (value && typeof value === "object" && !Array.isArray(value)) {
        const v = value as any
        return {
            defaultRate: toInt(v.defaultRate),
            defaultFreeShipping: toInt(v.defaultFreeShipping),
            defaultTaxRate: toNumber(v.defaultTaxRate),
            countries: Array.isArray(v.countries) ? v.countries.map(normalizeCountry) : [],
        }
    }
    if (typeof value !== "string" || value.trim() === "") {
        return { ...EMPTY_SHIPPING_CONFIG }
    }
    try {
        let parsed: any = JSON.parse(value)
        if (typeof parsed === "string") parsed = JSON.parse(parsed)
        return parseShippingConfig(parsed)
    } catch {
        return { ...EMPTY_SHIPPING_CONFIG }
    }
}
