import { Order } from "@vendure/core"
import { isValidItalianTaxNumber, normalizeTaxNumber } from "./tax-number"
import { isCouponSku, isOnlineVoucherRedemptionEnabled } from "../../ht-plugin/constants"

/**
 * Error codes returned as `transitionError` of the `OrderStateTransitionError` when the order
 * is moved to `ArrangingPayment`. The storefront maps them to its own (translated) messages.
 */
export type TandemCheckoutError = "CUSTOMER_NAME_REQUIRED" | "COUNTRY_REQUIRED" | "TAX_NUMBER_REQUIRED" | "TAX_NUMBER_INVALID" | "VOUCHER_ONLINE_REDEMPTION_DISABLED"

/** ISO country code for which the tax number (codice fiscale / P.IVA) is required. */
export const TAX_NUMBER_COUNTRY_CODE = "IT"

/**
 * Checkout rules of the old TYPO3 shop: firstname, lastname, email (enforced by Vendure's
 * setCustomerForOrder) and country are required; the tax number is required for Italy.
 * Country and tax number are read from the billing address (`setOrderBillingAddress`,
 * custom field `taxnumber` of the ht-plugin).
 */
export function validateTandemCheckout(order: Order): TandemCheckoutError[] {
    const errors: TandemCheckoutError[] = []

    // the customer relation is not always loaded on the transition - Vendure itself requires a customer for ArrangingPayment
    const customer = order.customer
    if (customer && (!customer.firstName?.trim() || !customer.lastName?.trim())) {
        errors.push("CUSTOMER_NAME_REQUIRED")
    }

    // safety net for SHOP_VOUCHER_REDEEM_ONLINE=false (applyCouponCode already rejects vouchers); surcharges are checked when loaded
    if (!isOnlineVoucherRedemptionEnabled() && order.surcharges?.some((surcharge) => isCouponSku(surcharge.sku))) {
        errors.push("VOUCHER_ONLINE_REDEMPTION_DISABLED")
    }

    const countryCode = order.billingAddress?.countryCode?.trim().toUpperCase()
    if (!countryCode) {
        errors.push("COUNTRY_REQUIRED")
        return errors
    }

    if (countryCode === TAX_NUMBER_COUNTRY_CODE) {
        const taxNumber = normalizeTaxNumber((order.billingAddress as any)?.customFields?.taxnumber)
        if (!taxNumber) {
            errors.push("TAX_NUMBER_REQUIRED")
        } else if (!isValidItalianTaxNumber(taxNumber)) {
            errors.push("TAX_NUMBER_INVALID")
        }
    }
    return errors
}
