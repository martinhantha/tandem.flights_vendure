import { CreatePaymentErrorResult, CreatePaymentResult, LanguageCode, Logger, PaymentMethodHandler, SettlePaymentErrorResult, SettlePaymentResult } from "@vendure/core"
import { paymentHandlerArguments } from "./arguments"
import { paypalApiDomainTest, paypalApiDomainLive, loggerCtx } from "../constants"

const logPrefix = "PaypalPaymentHandler - "

/** Flattens a PayPal error body into one line, e.g. "UNPROCESSABLE_ENTITY - SHIPPING_ADDRESS_INVALID - Provided shipping address is invalid." */
export const paypalErrorMessage = (body: any): string => {
    const detail = body?.details?.[0]
    const parts = [body?.name, detail?.issue, detail?.description || body?.message].filter(Boolean)
    return parts.length ? parts.join(" - ") : "Unknown PayPal error"
}

const hasIssue = (body: any, issue: string): boolean => Array.isArray(body?.details) && body.details.some((detail: any) => detail?.issue === issue)

/** Status of the capture PayPal made for the order: COMPLETED | PENDING | DECLINED | FAILED. Falls back to the order status. */
const captureStatusOf = (body: any): string | undefined => body?.purchase_units?.[0]?.payments?.captures?.[0]?.status || body?.status

const requestAccessToken = async (requestDomain: string, clientId: string, secret: string): Promise<{ ok: boolean; accessToken?: string; body: any }> => {
    const response = await fetch(`${requestDomain}/v1/oauth2/token`, {
        method: "POST",
        headers: {
            Authorization: "Basic " + Buffer.from(`${clientId}:${secret}`).toString("base64"),
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body: "grant_type=client_credentials",
    })

    // The access token is handed back on its own so the rest of the body can be logged and stored
    // as payment metadata without leaking a live PayPal credential.
    const { access_token, ...body }: any = (await response.json()) ?? {}
    return { ok: response.ok && !!access_token, accessToken: access_token, body }
}

const fetchPaypalOrder = async (requestDomain: string, accessToken: string, paypalOrderId: string): Promise<{ ok: boolean; body: any }> => {
    const response = await fetch(`${requestDomain}/v2/checkout/orders/${paypalOrderId}`, {
        headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
        },
    })

    return { ok: response.ok, body: await response.json() }
}

export const paypalPaymentHandler = new PaymentMethodHandler({
    code: "paypal",
    description: [
        { languageCode: LanguageCode.en, value: "PayPal Payment Gateway" },
        { languageCode: LanguageCode.it, value: "Gateway di pagamento Paypal" },
        { languageCode: LanguageCode.de, value: "PayPal Zahlungsgateway" },
    ],
    args: paymentHandlerArguments,

    createPayment: async (ctx, order, amount, args, metadata): Promise<CreatePaymentResult | CreatePaymentErrorResult> => {
        // args holds clientId and secret, so it must never be logged
        Logger.debug(`${logPrefix} createPayment order ${order.code}, amount ${amount}, payerId ${metadata.PayerID ?? "-"}`, loggerCtx)

        const requestDomain = args.sandbox ? paypalApiDomainTest : paypalApiDomainLive
        const paypalOrderId = metadata.token

        if (!paypalOrderId) {
            Logger.error(`${logPrefix} No PayPal order token in metadata for order ${order.code}`, loggerCtx)
            return {
                amount,
                state: "Declined",
                errorMessage: "No PayPal order token was supplied",
                metadata,
            }
        }

        // Fetch the access token
        let accessToken: string
        try {
            const token = await requestAccessToken(requestDomain, String(args.clientId), String(args.secret))

            if (!token.ok) {
                Logger.error(`${logPrefix} PayPal token request failed: ${JSON.stringify(token.body)}`, loggerCtx)
                return {
                    amount,
                    state: "Error",
                    transactionId: paypalOrderId,
                    errorMessage: `Could not authenticate with PayPal: ${paypalErrorMessage(token.body)}`,
                    metadata: token.body,
                }
            }

            accessToken = token.accessToken as string
        } catch (error: any) {
            Logger.error(`${logPrefix} Error fetching PayPal token: ${error?.message ?? JSON.stringify(error)}`, loggerCtx)
            return {
                amount,
                state: "Error",
                transactionId: paypalOrderId,
                errorMessage: `Could not reach PayPal: ${error?.message ?? "unknown error"}`,
                metadata,
            }
        }

        // Capture the order. The payment may only settle if PayPal confirms the capture - a non-2xx
        // response (e.g. SHIPPING_ADDRESS_INVALID) means no money was taken.
        let captureOk: boolean
        let captureBody: any
        try {
            const response = await fetch(`${requestDomain}/v2/checkout/orders/${paypalOrderId}/capture`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    "Content-Type": "application/json",
                },
            })

            captureOk = response.ok
            captureBody = await response.json()

            // A repeated capture (reloaded return page, retried mutation) is not a failure: ask PayPal
            // for the order it already captured instead of declining a payment that went through.
            if (!captureOk && hasIssue(captureBody, "ORDER_ALREADY_CAPTURED")) {
                Logger.warn(`${logPrefix} PayPal order ${paypalOrderId} was already captured, reading its current state`, loggerCtx)
                const existing = await fetchPaypalOrder(requestDomain, accessToken, paypalOrderId)
                captureOk = existing.ok
                captureBody = existing.body
            }
        } catch (error: any) {
            Logger.error(`${logPrefix} Error capturing PayPal order ${paypalOrderId}: ${error?.message ?? JSON.stringify(error)}`, loggerCtx)
            return {
                amount,
                state: "Error",
                transactionId: paypalOrderId,
                errorMessage: `Could not capture the PayPal payment: ${error?.message ?? "unknown error"}`,
                metadata,
            }
        }

        if (!captureOk) {
            Logger.error(`${logPrefix} PayPal refused to capture order ${paypalOrderId}: ${JSON.stringify(captureBody)}`, loggerCtx)
            return {
                amount,
                state: "Declined",
                transactionId: paypalOrderId,
                errorMessage: paypalErrorMessage(captureBody),
                metadata: captureBody,
            }
        }

        const captureStatus = captureStatusOf(captureBody)
        Logger.debug(`${logPrefix} PayPal capture ${captureBody?.id} status ${captureStatus}`, loggerCtx)

        if (captureStatus === "COMPLETED") {
            return {
                amount,
                state: "Settled",
                transactionId: paypalOrderId,
                metadata: captureBody,
            }
        }

        // PENDING means PayPal holds the funds (e.g. manual review) and releases them later, so the
        // payment is authorised but must not count as paid yet.
        if (captureStatus === "PENDING") {
            return {
                amount,
                state: "Authorized",
                transactionId: paypalOrderId,
                metadata: captureBody,
            }
        }

        Logger.error(`${logPrefix} PayPal capture for order ${paypalOrderId} ended in state ${captureStatus}: ${JSON.stringify(captureBody)}`, loggerCtx)
        return {
            amount,
            state: "Declined",
            transactionId: paypalOrderId,
            errorMessage: `PayPal did not complete the capture (${captureStatus ?? "unknown status"})`,
            metadata: captureBody,
        }
    },

    settlePayment: async (ctx, order, payment, args): Promise<SettlePaymentResult | SettlePaymentErrorResult> => {
        Logger.debug(`${logPrefix} settlePayment order ${order.code}, payment ${payment.id}`, loggerCtx)

        const requestDomain = args.sandbox ? paypalApiDomainTest : paypalApiDomainLive
        const paypalOrderId = payment.transactionId

        // A Payment can only be settled out of "Authorized", and Vendure skips the transition when the
        // target state equals the current one. Staying in "Authorized" therefore records the reason on
        // the Payment without burning it - "Error" is terminal and could never be settled afterwards.
        const keepAuthorized = "Authorized" as const

        if (!paypalOrderId) {
            return { success: false, state: keepAuthorized, errorMessage: "Payment has no PayPal order id" }
        }

        try {
            const token = await requestAccessToken(requestDomain, String(args.clientId), String(args.secret))

            if (!token.ok) {
                Logger.error(`${logPrefix} PayPal token request failed: ${JSON.stringify(token.body)}`, loggerCtx)
                return { success: false, state: keepAuthorized, errorMessage: `Could not authenticate with PayPal: ${paypalErrorMessage(token.body)}`, metadata: token.body }
            }

            const paypalOrder = await fetchPaypalOrder(requestDomain, token.accessToken as string, paypalOrderId)

            if (!paypalOrder.ok) {
                Logger.error(`${logPrefix} Could not read PayPal order ${paypalOrderId}: ${JSON.stringify(paypalOrder.body)}`, loggerCtx)
                return { success: false, state: keepAuthorized, errorMessage: paypalErrorMessage(paypalOrder.body), metadata: paypalOrder.body }
            }

            const captureStatus = captureStatusOf(paypalOrder.body)
            Logger.debug(`${logPrefix} PayPal order ${paypalOrderId} capture status ${captureStatus}`, loggerCtx)

            // Only PayPal may decide that the money has arrived - never assume it.
            if (captureStatus !== "COMPLETED") {
                return {
                    success: false,
                    // PENDING can still turn into COMPLETED, anything else is a definitive failure.
                    state: captureStatus === "PENDING" ? keepAuthorized : "Error",
                    errorMessage: `PayPal has not completed the capture (${captureStatus ?? "unknown status"})`,
                    metadata: paypalOrder.body,
                }
            }

            return { success: true, metadata: paypalOrder.body }
        } catch (error: any) {
            Logger.error(`${logPrefix} Error settling PayPal order ${paypalOrderId}: ${error?.message ?? JSON.stringify(error)}`, loggerCtx)
            return { success: false, state: keepAuthorized, errorMessage: `Could not reach PayPal: ${error?.message ?? "unknown error"}` }
        }
    },
})
