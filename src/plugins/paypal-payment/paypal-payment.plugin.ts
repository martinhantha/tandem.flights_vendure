import { Logger, PluginCommonModule, VendurePlugin } from "@vendure/core"

import { PaypalPaymentResolver } from "./api/paypal-payment.resolver"
import { shopApiExtensions } from "./api/api-extensions"
import { paypalPaymentConfig } from "./paypal-payment.config"

export interface PaypalPaymentOptions {
    enabled: boolean
}

@VendurePlugin({
    imports: [PluginCommonModule, Logger],
    providers: [],
    configuration: paypalPaymentConfig,

    shopApiExtensions: {
        schema: shopApiExtensions,
        resolvers: [PaypalPaymentResolver],
    },

    compatibility: "^3.0.0",
})
export class PaypalPaymentPlugin {
    static options: PaypalPaymentOptions

    static init(options: PaypalPaymentOptions) {
        this.options = options
        return PaypalPaymentPlugin
    }
}
