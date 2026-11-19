import { OrderProcess, OrderState } from "@vendure/core"
import { validateTandemCheckout } from "./checkout-validation"

/**
 * Blocks the transition to ArrangingPayment until the checkout data is complete. Both payment
 * flows pass through it: PayPal (the storefront transitions before creating the PayPal order) and
 * Stripe (the webhook transitions the order before adding the payment).
 * The returned string ends up as `transitionError`; several errors are joined with ",".
 */
export const tandemCheckoutProcess: OrderProcess<OrderState> = {
    onTransitionStart(fromState, toState, data) {
        if (toState !== "ArrangingPayment") return
        const errors = validateTandemCheckout(data.order)
        if (errors.length) return errors.join(",")
    },
}
