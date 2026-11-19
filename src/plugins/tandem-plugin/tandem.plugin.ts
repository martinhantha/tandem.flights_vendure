import { PluginCommonModule, VendurePlugin } from "@vendure/core"
import { tandemShopApiExtensions } from "./api/shop-api"
import { VoucherCheckShopResolver } from "./api/voucher-check.resolver"
import { orderComment } from "./checkout/order-custom-fields"
import { tandemCheckoutProcess } from "./checkout/tandem-checkout-process"
import { VoucherCheckService } from "./voucher-check/voucher-check.service"

/**
 * tandem.flights specifics on top of the hantha ht-plugin:
 * - shop-api `checkVoucher(code)` for the public /qr page (status + validity only, rate limited)
 * - checkout rules of the old shop (country required, codice fiscale / P.IVA required for Italy)
 * - Order custom field `comment`
 *
 * Must be registered after HtPlugin (it uses the ht-plugin Voucher entity).
 */
@VendurePlugin({
    imports: [PluginCommonModule],
    providers: [VoucherCheckService],
    shopApiExtensions: {
        schema: tandemShopApiExtensions,
        resolvers: [VoucherCheckShopResolver],
    },
    configuration: (config) => {
        config.customFields.Order.push(orderComment)
        config.orderOptions.process = [...(config.orderOptions.process ?? []), tandemCheckoutProcess]
        return config
    },
    compatibility: "^3.0.0",
})
export class TandemPlugin {}
