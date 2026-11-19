export const HT_PLUGIN_OPTIONS = Symbol('HT_PLUGIN_OPTIONS');
export const loggerCtx = 'HtPlugin';
export const DEFAULT_CHANNEL_CODE = "__default_channel__"

// a redeemed voucher is stored on the order as a surcharge with the sku "coupon-<code>"
export const COUPON_SKU_PREFIX = "coupon-"
export const couponSku = (code: string) => COUPON_SKU_PREFIX + code
export const isCouponSku = (sku: string | undefined | null): boolean => !!sku && sku.startsWith(COUPON_SKU_PREFIX)
// slice, not split("-"): a voucher code may itself contain a "-"
export const couponCodeFromSku = (sku: string) => sku.slice(COUPON_SKU_PREFIX.length)
/**
 * SHOP_VOUCHER_REDEEM_ONLINE=false: vouchers (ht-plugin Voucher entity) cannot be redeemed in the shop API
 * (applyCouponCode), only on-site via the dashboard. Default (unset) = true = template behaviour.
 * Vendure promotion coupon codes are not affected.
 */
export const isOnlineVoucherRedemptionEnabled = (): boolean => (process.env.SHOP_VOUCHER_REDEEM_ONLINE ?? "true").toLowerCase() !== "false"
