import { GlobalSettingsService, LanguageCode } from "@vendure/core"
import { EmailEventListener } from "@vendure/email-plugin"
import i18next from "i18next"
import { getAddress, hydrateOrder, rebindEventCtxToChannel } from "./order-confirmation"
import { SendShippingEvent } from "../event/send-shipping-event"
import { applyShopPlaceholders } from "../../custom-email-plugin/utils/placeholder-utils"
import { getFooterLinks } from "../../custom-email-plugin/utils/shop-link-utils"
import { DEFAULT_CHANNEL_CODE } from "../constants"

const translate = (prefix: string, languageCode: string) => {
    return (key: string) => applyShopPlaceholders(i18next.t(`${prefix}.${key}`, { lng: languageCode }))
}

export const sendShippingHandler = new EmailEventListener("send-shipping")
    .on(SendShippingEvent)
    .loadData(async ({ event, injector }) => {
        // init services
        const globalSettingsService = injector.get(GlobalSettingsService)

        // hydrate order
        await hydrateOrder(event.ctx, event.order, injector)

        // get base info
        const languageCode = <LanguageCode>(event.order?.customFields?.languageCode ?? event.ctx.languageCode)
        const orderChannel = event.order.channels?.find((c) => c.code !== DEFAULT_CHANNEL_CODE) ?? event.order.channels?.[0] ?? event.ctx.channel
        rebindEventCtxToChannel(event, orderChannel)

        // get bcc
        const bccRecipients = await globalSettingsService.getSettings(event.ctx).then((settings) => settings.customFields.orderEmailCopyTo || undefined)

        // get base texts
        const shopAddress = await getAddress(event.ctx, injector, languageCode)

        // return data
        return { languageCode, bccRecipients, shopAddress }
    })
    .setRecipient((event) => event.order.customer!.emailAddress)
    .setOptionalAddressFields((event) => {
        return { bcc: event.data.bccRecipients }
    })
    .setFrom("{{ mailSender }}")
    .setSubject((event) => {
        return applyShopPlaceholders(i18next.t("sendShipping.subject", { lng: event.data.languageCode })) + " #" + event.order.code
    })
    .setTemplateVars((event) => {
        const { languageCode } = event.data
        const t = translate("sendShipping", languageCode)
        const t2 = translate("orderConfirmation", languageCode)
        const fulfillmentsWithTracking = (event.order.fulfillments ?? []).filter((fulfillment) => fulfillment.trackingCode?.trim())

        return {
            languageCode: languageCode,
            title: t("title"),
            text: t("text"),
            text2: t("text2"),
            order: event.order,
            codeTitle: t2("codeTitle"),
            dateTitle: t2("dateTitle"),
            handlebarsDateFormat: i18next.t("handlebarsDateFormat", { lng: "" + languageCode }),
            totalTitle: t2("totalTitle"),
            fulfillmentsTitle: t("fulfillmentsTitle"),
            fulfillmentsWithTracking: fulfillmentsWithTracking,
            footerText: applyShopPlaceholders(i18next.t("footerText", { lng: "" + languageCode }), { _SHOP_ADDRESS_: event.data.shopAddress ?? "" }),
            footerLinks: getFooterLinks(languageCode, event.order.code),
        }
    })
