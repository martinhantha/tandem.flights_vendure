const SHOP_NAME = process.env.SHOP_NAME || "_SHOP_NAME_"

// _SHOP_ADDRESS_ has no default: callers pass it as an override from the "shopAddress" textblock
const PLACEHOLDER_MAP: Record<string, string> = {
    _SHOP_NAME_: SHOP_NAME,
}

/**
 * Ensures that shared placeholder tokens in translations are replaced with runtime values.
 */
export function applyShopPlaceholders(value: string, overrides: Record<string, string> = {}) {
    const replacementMap = { ...PLACEHOLDER_MAP, ...overrides }
    return Object.entries(replacementMap).reduce((acc, [token, replacement]) => acc.replace(new RegExp(token, "g"), replacement ?? ""), value)
}
