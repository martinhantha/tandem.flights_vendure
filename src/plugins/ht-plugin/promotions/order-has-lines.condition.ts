import { LanguageCode, PromotionCondition } from "@vendure/core"

/**
 * Satisfied when the order has at least one line with quantity greater than 0.
 * Use with {@link facetVolumeTierUnitDiscountAction} so the promotion validates without relying on
 * `minimum_order_amount` at 0.
 */
export const orderHasLinesCondition = new PromotionCondition({
    code: "order_has_lines",
    description: [
        { languageCode: LanguageCode.de, value: "Bestellung enthält mindestens eine Position mit Menge größer 0" },
        { languageCode: LanguageCode.en, value: "Order has at least one line with quantity greater than 0" },
        { languageCode: LanguageCode.it, value: "L'ordine contiene almeno una riga con quantità maggiore di 0" },
    ],
    args: {},
    check(ctx, order) {
        return order.lines.some((l) => l.quantity > 0)
    },
})
