import i18next from "i18next"

export type ShopLinkTarget = "shop" | "withdrawal" | "imprint" | "privacy"

/**
 * Frontend url depending on the environment.
 */
export function getShopUrl(): string {
    return (process.env.APP_ENV === "dev" ? process.env.SHOP_URL_DEV : process.env.SHOP_URL_PROD) ?? ""
}

/**
 * Links a shop page via the frontend's /api/shop-link redirect, which resolves the current url from TYPO3.
 * Additional params are passed on to the page, e.g. { ordernumber } prefills the withdrawal form.
 */
export function getShopLink(target: ShopLinkTarget, languageCode: string, params: Record<string, string> = {}): string {
    const shopUrl = getShopUrl()
    if (!shopUrl) return ""

    const query = new URLSearchParams({ target, lang: languageCode, ...params })
    return `${shopUrl}/api/shop-link?${query}`
}

/**
 * Footer links of the customer emails, the withdrawal form gets prefilled with the order code if given.
 */
export function getFooterLinks(languageCode: string, orderCode?: string): Array<{ title: string; url: string }> {
    if (!getShopUrl()) return []

    return [
        { title: i18next.t("footerLinks.withdrawal", { lng: languageCode }), url: getShopLink("withdrawal", languageCode, orderCode ? { ordernumber: orderCode } : {}) },
        { title: i18next.t("footerLinks.imprint", { lng: languageCode }), url: getShopLink("imprint", languageCode) },
        { title: i18next.t("footerLinks.privacy", { lng: languageCode }), url: getShopLink("privacy", languageCode) },
    ]
}
