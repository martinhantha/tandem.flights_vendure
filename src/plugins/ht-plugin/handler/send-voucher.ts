import { ConfigService, GlobalSettingsService, LanguageCode, Logger, ProductService } from "@vendure/core"
import { EmailAttachment, EmailEventListener } from "@vendure/email-plugin"
import { VoucherByOrderService } from "../services/voucher-by-order-service"
import { VoucherService } from "../entities/voucher/service"
// import { mockOrderStateTransitionEvent } from "./mock-events"
import i18next from "i18next"
import { TextblockService } from "../entities/textblock/service"
import { SendVoucherEvent } from "../event/send-voucher-event"
import { getAddress, hydrateOrder, rebindEventCtxToChannel } from "./order-confirmation"
import { CustomSettingsService } from "../entities/customSettings/service"
import { applyShopPlaceholders } from "../../custom-email-plugin/utils/placeholder-utils"
import { getFooterLinks } from "../../custom-email-plugin/utils/shop-link-utils"
import { DEFAULT_CHANNEL_CODE } from "../constants"

const translate = (prefix: string, languageCode: string) => {
    return (key: string) => applyShopPlaceholders(i18next.t(`${prefix}.${key}`, { lng: languageCode }))
}

export const sendVoucherHandler = new EmailEventListener("send-voucher")
    .on(SendVoucherEvent)
    .loadData(async ({ event, injector }) => {
        // init services
        const globalSettingsService = injector.get(GlobalSettingsService)
        const customSettingsService = injector.get(CustomSettingsService)
        const voucherByOrderService = new VoucherByOrderService(customSettingsService, injector.get(ProductService), injector.get(VoucherService), injector.get(ConfigService), injector.get(TextblockService))

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

        // voucher data
        let vouchers = <EmailAttachment[]>[]
        let voucherZipUrl = ""

        const voucherResult = await voucherByOrderService.getVoucherByOrder(event.ctx, event.order)
        if (Array.isArray(voucherResult)) vouchers = voucherResult
        else voucherZipUrl = voucherResult

        // return data
        return { languageCode, bccRecipients, shopAddress, vouchers, voucherZipUrl }
    })
    .setRecipient((event) => event.order.customer!.emailAddress)
    .setOptionalAddressFields((event) => {
        return { bcc: event.data.bccRecipients }
    })
    .setFrom("{{ mailSender }}")
    .setSubject((event) => {
        return applyShopPlaceholders(i18next.t("sendVoucher.subject", { lng: event.data.languageCode })) + " #" + event.order.code
    })
    .setTemplateVars((event) => {
        const { languageCode } = event.data
        const t = translate("sendVoucher", languageCode)
        return {
            languageCode: languageCode,
            voucherZipUrl: event.data.voucherZipUrl,
            voucherZipUrlButtonText: t("voucherZipUrlButtonText"),
            title: t("title"),
            text: t("text"),
            order: event.order,
            footerText: applyShopPlaceholders(i18next.t("footerText", { lng: "" + languageCode }), { _SHOP_ADDRESS_: event.data.shopAddress ?? "" }),
            footerLinks: getFooterLinks(languageCode, event.order.code),
        }
    })
    .setAttachments(async (event) => {
        return event.data.vouchers
    })
// .setMockEvent(mockOrderStateTransitionEvent)
