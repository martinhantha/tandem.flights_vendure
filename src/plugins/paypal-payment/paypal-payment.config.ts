import { paypalPaymentHandler } from "./handler/paypal-payment.handler"
import { PluginConfigurationFn, RuntimeVendureConfig } from "@vendure/core"

export const paypalPaymentConfig: PluginConfigurationFn = (config: RuntimeVendureConfig): RuntimeVendureConfig => {
    config.paymentOptions.paymentMethodHandlers.push(paypalPaymentHandler)
    return config
}
