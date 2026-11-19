import { LanguageCode, PromotionItemAction } from "@vendure/core"

/**
 * Applies the per-line percentage discount stored in the OrderLine custom field
 * `discountPercent` (set manually in the admin order editor). Attach this action
 * to an auto-applied promotion (no coupon code) so every order recalculation
 * re-reads the field. Lines without a value simply return 0.
 */
export const manualLineDiscount = new PromotionItemAction({
    code: "manual_line_discount",
    description: [
        {
            languageCode: LanguageCode.de,
            value: "Manueller Positionsrabatt: wendet den pro Position gesetzten Rabatt (Feld „Rabatt %“) an.",
        },
        {
            languageCode: LanguageCode.en,
            value: 'Manual line discount: applies the per-line discount set in the "Discount %" field.',
        },
    ],
    args: {},
    execute(ctx, orderLine) {
        const percent = Number((orderLine.customFields as { discountPercent?: number }).discountPercent ?? 0)
        if (!Number.isFinite(percent) || percent <= 0) {
            return 0
        }
        const clamped = Math.min(100, percent)
        const unitPrice = ctx.channel.pricesIncludeTax ? orderLine.unitPriceWithTax : orderLine.unitPrice
        return -unitPrice * (clamped / 100)
    },
})
