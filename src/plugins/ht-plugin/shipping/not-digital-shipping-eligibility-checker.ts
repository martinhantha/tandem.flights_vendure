import { LanguageCode, ShippingEligibilityChecker } from "@vendure/core"
import { initOrderHasPhysicalProduct, orderHasPhysicalProduct } from "./order-has-physical-product"

export const notDigitalShippingEligibilityChecker = new ShippingEligibilityChecker({
    init: (injector) => {
        initOrderHasPhysicalProduct(injector)
    },
    code: "not-digital-shipping-eligibility-checker",
    description: [
        {
            languageCode: LanguageCode.en,
            value: "Bestellungen mit mindestens einem NICHT digitalem Produkt",
        },
    ],
    args: {},
    check: async (ctx, order, args) => {
        return orderHasPhysicalProduct(ctx, order)
    },
})
