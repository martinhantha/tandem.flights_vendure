import { ShippingEligibilityChecker, RequestContext, LanguageCode} from "@vendure/core"
import { initOrderHasPhysicalProduct, orderHasPhysicalProduct } from "./order-has-physical-product"

export const digitalShippingEligibilityChecker = new ShippingEligibilityChecker({
    init: (injector) => {
        initOrderHasPhysicalProduct(injector)
    },
    code: "digital-shipping-eligibility-checker",
    description: [
        {
            languageCode: LanguageCode.en,
            value: "Bestellungen mit nur digitalen Produkten",
        },
    ],
    args: {},
    check: async (ctx: RequestContext, order, args): Promise<boolean> => {
        return !(await orderHasPhysicalProduct(ctx, order))
    },
})
