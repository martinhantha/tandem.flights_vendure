import { Query, Resolver } from "@nestjs/graphql"
import { ActiveOrderService, Allow, Ctx, Logger, OrderService, PaymentMethodService, Permission, RequestContext, UnauthorizedError, UserInputError } from "@vendure/core"
import { paypalErrorMessage, paypalPaymentHandler } from "../handler/paypal-payment.handler"
import { paypalApiDomainLive, paypalApiDomainTest, loggerCtx } from "../constants"

const logPrefix = "PaypalPaymentResolver - "

@Resolver()
export class PaypalPaymentResolver {
    constructor(
        private paymentMethodService: PaymentMethodService,
        private activeOrderService: ActiveOrderService,
        private orderService: OrderService,
    ) {}

    @Query()
    @Allow(Permission.Owner)
    async createPaypalPayment(@Ctx() ctx: RequestContext): Promise<string> {
        if (!ctx.authorizedAsOwnerOnly) {
            throw new UnauthorizedError()
        }
        const sessionOrder = await this.activeOrderService.getActiveOrder(ctx, undefined)
        if (!sessionOrder) {
            throw new UserInputError(`${logPrefix} No active order found for session`)
        }

        const order = await this.orderService.findOne(ctx, sessionOrder.id)

        if (!order) {
            throw new UserInputError(`${logPrefix} No order found`)
        }

        const [eligiblePaymentMethods, paymentMethods] = await Promise.all([
            this.paymentMethodService.getEligiblePaymentMethods(ctx, sessionOrder),
            this.paymentMethodService.findAll(ctx, {
                filter: {
                    enabled: { eq: true },
                },
            }),
        ])

        const paypalPaymentMethod = paymentMethods.items.find((pm) => pm.handler.code === paypalPaymentHandler.code)
        if (!paypalPaymentMethod) {
            throw new UserInputError(`${logPrefix} No enabled Paypal payment method found`)
        }

        const sandbox = paypalPaymentMethod.handler.args.find((arg) => arg.name === "sandbox")?.value
        const requestDomain = sandbox === "true" ? paypalApiDomainTest : paypalApiDomainLive

        // Fetch the access token
        let tokenResponse: any = {}
        let tokenResponseJson: any = {}
        try {
            const clientId = paypalPaymentMethod.handler.args.find((arg) => arg.name === "clientId")?.value
            const secret = paypalPaymentMethod.handler.args.find((arg) => arg.name === "secret")?.value

            if (!clientId || !secret) {
                throw new UserInputError(`${logPrefix} Paypal payment method is not configured`)
            }

            const requestUrl = `${requestDomain}/v1/oauth2/token`
            const requestHeaders = {
                Authorization: "Basic " + Buffer.from(`${clientId}:${secret}`).toString("base64"),
                "Content-Type": "application/x-www-form-urlencoded",
            }

            tokenResponse = await fetch(requestUrl, {
                method: "POST",
                headers: requestHeaders,
                body: "grant_type=client_credentials",
            })

            tokenResponseJson = await tokenResponse.json()

            if (tokenResponse?.status >= 400) {
                const variables = {
                    clientId: clientId || "undefined",
                    secret: secret || "undefined",
                    sandbox: sandbox || "undefined",
                    requestUrl: requestUrl || "undefined",
                    headers: JSON.stringify(requestHeaders, null, 2),
                    response: JSON.stringify(tokenResponseJson, null, 2),
                }

                throw new UserInputError(`${logPrefix} PayPal API error`, variables)
            }
        } catch (error) {
            if (error instanceof UserInputError) throw error
            throw new UserInputError(`${logPrefix} Error fetching PayPal token: ${JSON.stringify(error)}`)
        }

        // Order creation
        let orderResponse: any = {}
        let orderResponseJson: any = {}
        try {
            const brandName = paypalPaymentMethod.handler.args.find((arg) => arg.name === "brandName")?.value
            const cancelPath = paypalPaymentMethod.handler.args.find((arg) => arg.name === "cancelPath")?.value
            const returnPath = paypalPaymentMethod.handler.args.find((arg) => arg.name === "returnPath")?.value
            const accessToken = tokenResponseJson?.access_token

            if (!accessToken) {
                const variables = {
                    brandName: brandName || "undefined",
                    cancelPath: cancelPath || "undefined",
                    returnPath: returnPath || "undefined",
                    accessToken: accessToken || "undefined",
                }

                throw new UserInputError(`${logPrefix} No access token received from PayPal`, variables)
            }

            const requestUrl = `${requestDomain}/v2/checkout/orders`
            const requestHeaders = {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
            }
            const shippingAddress = order.shippingAddress
            const paypalShipping = shippingAddress?.streetLine1 && shippingAddress?.countryCode
                ? {
                      type: "SHIPPING",
                      name: {
                          full_name: shippingAddress.fullName?.trim() || `${order.customer?.firstName ?? ""} ${order.customer?.lastName ?? ""}`.trim(),
                      },
                      address: {
                          address_line_1: shippingAddress.streetLine1,
                          address_line_2: shippingAddress.streetLine2 || undefined,
                          admin_area_2: shippingAddress.city || undefined,
                          admin_area_1: shippingAddress.province || undefined,
                          postal_code: shippingAddress.postalCode || undefined,
                          country_code: shippingAddress.countryCode,
                      },
                  }
                : undefined

            const paypalAmount = (minorUnits: number) => ({ currency_code: order.currencyCode, value: (minorUnits / 100).toFixed(2) })

            // The breakdown comes from the order-level figures only: total is subTotal + shipping, so the parts
            // add up to totalWithTax exactly. `items` stays out: PayPal wants net unit amounts, and those don't
            // add up to the order's net once tax and prorated discounts are rounded.
            const requestBody = JSON.stringify({
                intent: "CAPTURE",
                purchase_units: [
                    {
                        reference_id: order.code,
                        invoice_id: order.code,
                        amount: {
                            ...paypalAmount(order.totalWithTax),
                            breakdown: {
                                item_total: paypalAmount(order.subTotal),
                                shipping: paypalAmount(order.shipping),
                                tax_total: paypalAmount(order.totalWithTax - order.total),
                            },
                        },
                        ...(paypalShipping ? { shipping: paypalShipping } : {}),
                    },
                ],
                payment_source: {
                    paypal: {
                        experience_context: {
                            brand_name: brandName,
                            locale: ctx.languageCode,
                            user_action: "PAY_NOW",
                            shipping_preference: paypalShipping ? "SET_PROVIDED_ADDRESS" : "NO_SHIPPING",
                            return_url: process.env.SHOP_URL_PROD + `/${ctx.languageCode}/${returnPath}`,
                            cancel_url: process.env.SHOP_URL_PROD + `/${ctx.languageCode}/${cancelPath}`,
                        },
                    },
                },
            })

            // PayPal-Order erzeugen
            orderResponse = await fetch(requestUrl, {
                method: "POST",
                headers: requestHeaders,
                body: requestBody,
            })

            orderResponseJson = await orderResponse.json()
            Logger.debug(`${logPrefix} PayPal Order Response: ${JSON.stringify(orderResponseJson)}`, loggerCtx)

            if (!orderResponse.ok) {
                const variables = {
                    requestUrl: requestUrl || "undefined",
                    accessToken: accessToken || "undefined",
                    headers: JSON.stringify(requestHeaders, null, 2),
                    body: JSON.stringify(requestBody, null, 2),
                    response: JSON.stringify(orderResponseJson, null, 2),
                }

                throw new UserInputError(`${logPrefix} PayPal API error: ${paypalErrorMessage(orderResponseJson)}`, variables)
            }
        } catch (error) {
            // Keep the UserInputError thrown above intact - it carries PayPal's own reason for the rejection.
            if (error instanceof UserInputError) throw error
            throw new UserInputError(`${logPrefix} Error creating PayPal order: ${JSON.stringify(error)}`)
        }

        const approvalUrl = orderResponseJson.links?.find((link: any) => link.rel === "payer-action" || link.rel === "approve")?.href

        return approvalUrl ? approvalUrl : "No approval URL found"
    }
}
