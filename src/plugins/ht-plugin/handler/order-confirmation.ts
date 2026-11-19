import { Channel, GlobalSettingsService, ConfigService, EntityHydrator, ID, Injector, LanguageCode, Logger, Order, Payment, ProductService, Promotion, RequestContext, TransactionalConnection, TranslatorService } from "@vendure/core"
import { EmailAttachment, EmailEventListener } from "@vendure/email-plugin"
import i18next from "i18next"
import { In } from "typeorm"
import { PaymentMethod } from "@vendure/core"
import { TextblockService } from "../entities/textblock/service"
import { CustomOrderConfirmationEvent } from "../event/custom-order-configuration-event"
import { applyShopPlaceholders } from "../../custom-email-plugin/utils/placeholder-utils"
import { nl2br } from "../../custom-email-plugin/utils/text-utils"
import { getFooterLinks, getShopLink } from "../../custom-email-plugin/utils/shop-link-utils"
import { VoucherByOrderService } from "../services/voucher-by-order-service"
import { CustomSettingsService } from "../entities/customSettings/service"
import { VoucherService } from "../entities/voucher/service"
import { DEFAULT_CHANNEL_CODE } from "../constants"

const translate = (prefix: string, languageCode: string) => {
    return (key: string) => applyShopPlaceholders(i18next.t(`${prefix}.${key}`, { lng: languageCode }))
}
const loggerCtx = "Order Confirmation Handler"

export const orderConfirmationHandler = new EmailEventListener("order-confirmation")
    .on(CustomOrderConfirmationEvent)
    .loadData(async ({ event, injector }) => {
        // init services
        const globalSettingsService = injector.get(GlobalSettingsService)
        const customSettingsService = injector.get(CustomSettingsService)
        const voucherByOrderService = new VoucherByOrderService(customSettingsService, injector.get(ProductService), injector.get(VoucherService), injector.get(ConfigService), injector.get(TextblockService))

        // hydrate order
        await hydrateOrder(event.ctx, event.order, injector)

        // get base info
        const languageCode = <LanguageCode>(event.order?.customFields.languageCode ?? event.ctx.languageCode)
        const orderChannel = event.order.channels?.find((c) => c.code !== DEFAULT_CHANNEL_CODE) ?? event.order.channels?.[0] ?? event.ctx.channel
        rebindEventCtxToChannel(event, orderChannel)

        // get bcc
        const bccRecipients = event.email ? undefined : await globalSettingsService.getSettings(event.ctx).then((settings) => settings.customFields.orderEmailCopyTo || undefined)

        // get base texts
        const infoText = await getInfoText(event.ctx, event.order, injector, languageCode, event.order.customer?.firstName + " " + event.order.customer?.lastName)
        const shopAddress = await getAddress(event.ctx, injector, languageCode)
        const preFooterText = await getPreFooterText(event.ctx, injector, languageCode)

        // get orderlines
        const orderLines = event.order.lines

        // hydrate shipping lines
        const shippingLines = await hydrateShippingLines(event.ctx, event.order, injector)

        // enrich discounts
        const discounts = await enrichDiscounts(event.ctx, event.order, injector)

        // group tax by rate
        const taxLines = getTaxLines(event.order, languageCode)

        // hydrate payments
        const payments = await hydratePayments(event.ctx, event.order, injector)

        // get current payment
        const currentPayment = payments?.find((payment) => payment.state === "Settled" || payment.state === "Authorized")

        // init voucher
        let vouchers = <EmailAttachment[]>[]
        let voucherZipUrl = ""
        let hasVoucherInfo = true

        // add voucher
        if (event.order.state === "PaymentSettled") {
            const voucherResult = await voucherByOrderService.getVoucherByOrder(event.ctx, event.order)
            if (Array.isArray(voucherResult)) vouchers = voucherResult
            else voucherZipUrl = voucherResult
            hasVoucherInfo = false
        }

        // get voucher text
        if (hasVoucherInfo) hasVoucherInfo = !!event.order.lines.find((line) => !line.productVariant.product.customFields.isDigital)
        const voucherText = await getVoucherText(event.ctx, event.order, injector, languageCode, (vouchers?.length ?? 0) > 0 || hasVoucherInfo || voucherZipUrl !== "", currentPayment?.method ?? "")

        // return data
        return { languageCode, bccRecipients, infoText, shopAddress, preFooterText, orderLines, shippingLines, discounts, taxLines, payments, vouchers, voucherZipUrl, voucherText }
    })
    .setRecipient((event) => event.email ?? event.order.customer!.emailAddress)
    .setOptionalAddressFields((event) => {
        return { bcc: event.data.bccRecipients }
    })
    .setFrom("{{ mailSender }}")
    .setSubject((event) => {
        return applyShopPlaceholders(i18next.t("orderConfirmation.subject", { lng: event.data.languageCode })) + " #" + event.order.code
    })
    .setTemplateVars((event) => {
        const { languageCode } = event.data
        const t = translate("orderConfirmation", languageCode)

        return {
            languageCode: languageCode,
            voucherZipUrlButtonText: t("voucherZipUrlButtonText"),
            voucherText: event.data.voucherText,
            voucherZipUrl: event.data.voucherZipUrl,
            title: t("title"),
            infoText: event.data.infoText.replace(/(?:\r\n|\r|\n)/g, "<br>"),
            order: event.order,
            codeTitle: t("codeTitle"),
            dateTitle: t("dateTitle"),
            handlebarsDateFormat: i18next.t("handlebarsDateFormat", { lng: "" + languageCode }),
            totalTitle: t("totalTitle"),
            contactTitle: t("contactTitle"),
            billingAddressTitle: t("billingAddressTitle"),
            shippingAddressTitle: t("shippingAddressTitle"),
            shippingMethodTitle: t("shippingMethodTitle"),
            paymentMethodTitle: t("paymentMethodTitle"),
            orderLinesTitle: t("orderLinesTitle"),
            deliveryTimeTitle: t("deliveryTimeTitle"),
            orderLines: event.data.orderLines,
            shippingLines: event.data.shippingLines,
            payments: event.data.payments,
            discountTitle: t("discountTitle"),
            discounts: event.data.discounts,
            subTotalTitle: t("subTotalTitle"),
            shippingTitle: t("shippingTitle"),
            taxTitle: t("taxTitle"),
            taxLines: event.data.taxLines,
            seeMore: t("seeMore"),
            toTheShop: t("toTheShop"),
            shopLink: getShopLink("shop", languageCode),
            preFooterText: event.data.preFooterText,
            footerText: applyShopPlaceholders(i18next.t("footerText", { lng: "" + languageCode }), { _SHOP_ADDRESS_: event.data.shopAddress ?? "" }),
            footerLinks: getFooterLinks(languageCode, event.order.code),
        }
    })
    .setAttachments(async (event) => {
        return [...event.data.vouchers]
    })

/**
 * @description
 * Ensures that the OrderLines are hydrated so that we can use the
 * `product.name` property in the email template.
 *
 */
// async function hydrateOrderLines(ctx: RequestContext, order: Order, injector: Injector): Promise<OrderLine[]> {
// 	const orderLines: OrderLine[] = []
// 	const entityHydrator = injector.get(EntityHydrator)

// 	for (const line of order.lines || []) {
// 		await entityHydrator.hydrate(ctx, line, {
// 			relations: ['productVariant.product'],
// 		})
// 		orderLines.push(line)
// 	}
// 	return orderLines
// }

/**
 * Payment method codes are only unique per channel, so an unscoped lookup by code can return another
 * channel's method - and with it that channel's bank details in the confirmation. The order's channel
 * wins; the unscoped lookup is the fallback for a method that is no longer assigned to it.
 */
export async function findPaymentMethodForChannel(ctx: RequestContext, connection: TransactionalConnection, code: string, channelId: ID): Promise<PaymentMethod | null> {
    const repository = connection.getRepository(ctx, PaymentMethod)
    const scoped = await repository
        .createQueryBuilder("paymentMethod")
        // translations are an eager relation, which a QueryBuilder does not load on its own
        .leftJoinAndSelect("paymentMethod.translations", "translation")
        .innerJoin("paymentMethod.channels", "channel")
        .where("paymentMethod.code = :code", { code })
        .andWhere("channel.id = :channelId", { channelId })
        .orderBy("paymentMethod.id", "ASC")
        .getOne()
    return scoped ?? (await repository.findOne({ where: { code } }))
}

/**
 * @description
 * Ensures that the Payments are hydrated so that we can use the
 * `paymentMethod.name` property in the email template.
 *
 */
async function hydratePayments(ctx: RequestContext, order: Order, injector: Injector): Promise<Payment[]> {
    const connection = injector.get(TransactionalConnection)
    // const entityHydrator = injector.get(EntityHydrator)
    const translatorService = injector.get(TranslatorService)
    const payments: Payment[] = []

    for (const payment of order.payments || []) {
        const customPayment = payment as any
        const paymentMethod = await findPaymentMethodForChannel(ctx, connection, payment.method, ctx.channelId)
        if (paymentMethod) {
            const translatedPaymentMethod = translatorService.translate(paymentMethod, ctx)
            if (translatedPaymentMethod) {
                customPayment.paymentMethod = translatedPaymentMethod
            }
        }

        // expose non-sensitive SEPA summary for the confirmation template (never include full IBAN)
        const meta = (payment.metadata ?? {}) as Record<string, any>
        if (meta.public && (meta.public.ibanLast4 || meta.public.mandateReference)) {
            customPayment.sepaSummary = {
                ibanLast4: meta.public.ibanLast4 ?? "",
                bic: meta.public.bic ?? "",
                bankName: meta.public.bankName ?? "",
                mandateReference: meta.public.mandateReference ?? "",
            }
        }

        const allowedStates = ["Settled", "Authorized"]
        if (allowedStates.includes(payment.state)) {
            payments.push(customPayment)
        }
    }
    return payments
}

async function getVoucherText(ctx: RequestContext, order: Order, injector: Injector, languageCode: string, hasVoucher: boolean, paymentMethod: string): Promise<string> {
    const textblockService = injector.get(TextblockService)

    let voucherTextKey = ""

    if (hasVoucher) {
        switch (paymentMethod) {
            case "nexi":
                voucherTextKey = "orderVoucherTextNexi"
                break
            case "banktransfer":
                voucherTextKey = "orderVoucherTextBanktransfer"
                break
            default:
                // e.g. paypal / stripe: the vouchers are attached to the confirmation right away
                voucherTextKey = "orderVoucherText"
        }
    } else if (paymentMethod === "banktransfer" && order.lines.filter((line) => line.customFields.voucher)) {
        voucherTextKey = "orderOnlyProductTextByBanktransfer"
    }
    const voucherText = voucherTextKey ? await textblockService.getText(ctx, voucherTextKey, languageCode) : ""

    return voucherText.replace(/(?:\r\n|\r|\n)/g, "<br>").replace(/{{orderCode}}/g, order.code)
}

async function getInfoText(ctx: RequestContext, order: Order, injector: Injector, languageCode: string, name: string = ""): Promise<string> {
    const textblockService = injector.get(TextblockService)
    const infoText = await textblockService.getText(ctx, "orderInfoText", languageCode)
    return infoText.replace(/{name}/g, name)
}

export async function hydrateOrder(ctx: RequestContext, order: Order, injector: Injector) {
    const entityHydrator = injector.get(EntityHydrator)
    const translatorService = injector.get(TranslatorService)

    await entityHydrator.hydrate(ctx, order, {
        relations: ["payments", "fulfillments", "customer", "surcharges", "channels"],
    })

    for (const line of order.lines || []) {
        await entityHydrator.hydrate(ctx, line, {
            relations: ["productVariant.product", "productVariant.facetValues", "productVariant.facetValues.facet"],
        })
        // translate the productVariant and its product to ensure localized names are available in the email template
        line.productVariant = translatorService.translate(line.productVariant, ctx)
        line.productVariant.product = translatorService.translate(line.productVariant.product, ctx)
    }
}
/**
 * Rebinds `event.ctx` to the given channel. Needed for EmailPlugin's per-send `transport(injector, ctx)`
 * to see the order's channel (not the admin's active channel) when an email is enqueued from the admin UI
 * (e.g. re-send order mail). The EmailEventListener serializes `event.ctx` after `loadData` returns,
 * so mutating it here propagates through to the queued job and the transport resolver.
 */
export function rebindEventCtxToChannel(event: { ctx: RequestContext }, channel: Channel): void {
    if (event.ctx.channel?.id === channel.id) return
    event.ctx = RequestContext.deserialize({ ...event.ctx.serialize(), _channel: channel as any })
}

export async function getAddress(ctx: RequestContext, injector: Injector, languageCode?: string, channel: Channel = ctx.channel): Promise<string> {
    const lang = languageCode ?? ctx.languageCode
    const textblockService = injector.get(TextblockService)
    // the footer renders it unescaped, so a rich-text textblock keeps its markup and a plain-text one its line breaks
    return nl2br(await textblockService.getText(ctx, "shopAddress", lang))
}

async function getPreFooterText(ctx: RequestContext, injector: Injector, languageCode: string): Promise<string> {
    const textblockService = injector.get(TextblockService)
    let infoText = await textblockService.getText(ctx, "orderPreFooterText", languageCode)
    infoText = infoText.replace(/{shopName}/g, process.env.SHOP_NAME || "")
    return infoText
}

export async function hydrateShippingLines(ctx: RequestContext, order: Order, injector: Injector) {
    const entityHydrator = injector.get(EntityHydrator)

    await entityHydrator.hydrate(ctx, order, {
        relations: ["shippingLines", "shippingLines.shippingMethod"],
    })
    return order.shippingLines
}

/**
 * @description
 * One row per tax rate for the "incl. VAT" lines below the total. Vendure splits the
 * taxSummary by tax description (product vs. shipping tax) and keeps 0 € rows for free
 * shipping - both are merged/dropped here, like in the checkout.
 *
 */
function getTaxLines(order: Order, languageCode: string) {
    const format = new Intl.NumberFormat(languageCode.replace("_", "-"), { maximumFractionDigits: 2 })
    const taxByRate = new Map<number, number>()
    for (const line of order.taxSummary) {
        if (line.taxBase <= 0 || line.taxRate <= 0) continue
        taxByRate.set(line.taxRate, (taxByRate.get(line.taxRate) ?? 0) + line.taxTotal)
    }
    return [...taxByRate.entries()].sort(([a], [b]) => a - b).map(([rate, taxTotal]) => ({ rateLabel: `${format.format(rate)}%`, taxTotal }))
}

async function enrichDiscounts(ctx: RequestContext, order: Order, injector: Injector) {
    const discounts = order.discounts ?? []
    if (discounts.length === 0) return []

    const connection = injector.get(TransactionalConnection)
    const promotionIds = Array.from(new Set(discounts.map((d) => d.adjustmentSource?.split(":")[1]).filter((id): id is string => !!id)))

    const promotions = promotionIds.length > 0 ? await connection.getRepository(ctx, Promotion).findBy({ id: In(promotionIds) }) : []
    const codeById = new Map(promotions.map((p) => [String(p.id), p.couponCode ?? null]))

    return discounts.map((d) => ({
        ...d,
        couponCode: codeById.get(d.adjustmentSource?.split(":")[1] ?? "") ?? null,
    }))
}
