import { EmailEventHandler, EmailEventListener } from "@vendure/email-plugin"
import { AccountRegistrationEvent, PasswordResetEvent, IdentifierChangeRequestEvent, NativeAuthenticationMethod, LanguageCode } from "@vendure/core"
import { mockAccountRegistrationEvent, mockPasswordResetEvent, mockEmailAddressChangeEvent } from "./mock-events"
import i18next from "i18next"
import { getAddress, orderConfirmationHandler } from "../../ht-plugin/handler/order-confirmation"
import { applyShopPlaceholders } from "../utils/placeholder-utils"
import { getFooterLinks } from "../utils/shop-link-utils"
import { sendShippingHandler } from "../../ht-plugin/handler/send-shipping"
import { sendVoucherHandler } from "../../ht-plugin/handler/send-voucher"
import { lowStockHandler } from "../../ht-plugin/handler/low-stock"

const translate = (prefix: string, languageCode: string) => {
    return (key: string) => applyShopPlaceholders(i18next.t(`${prefix}.${key}`, { lng: languageCode }))
}

const translateRoot = (key: string, languageCode: string) => applyShopPlaceholders(i18next.t(key, { lng: languageCode }))

export const emailVerificationHandler = new EmailEventListener("email-verification")
    .on(AccountRegistrationEvent)
    .loadData(async ({ event, injector }) => {
        const shopAddress = await getAddress(event.ctx, injector)
        return { shopAddress }
    })
    .filter((event) => !!event.user.getNativeAuthenticationMethod().identifier)
    .filter((event) => {
        const nativeAuthMethod = event.user.authenticationMethods.find((m) => m instanceof NativeAuthenticationMethod) as NativeAuthenticationMethod | undefined
        return (nativeAuthMethod && !!nativeAuthMethod.identifier) || false
    })
    .filter((event) => !event.user.verified)
    .setRecipient((event) => event.user.identifier)
    .setFrom("{{ mailSender }}")
    .setSubject((event) => {
        return translateRoot("emailVerification.subject", event.ctx.languageCode)
    })
    .setTemplateVars((event) => {
        const languageCode = event.ctx.languageCode
        const t = translate("emailVerification", languageCode)
        return {
            verificationToken: event.user.getNativeAuthenticationMethod().verificationToken,
            title: t("title"),
            text: t("text"),
            buttonText: t("buttonText"),
            info: t("info"),
            footerText: applyShopPlaceholders(i18next.t("footerText", { lng: "" + languageCode }), { _SHOP_ADDRESS_: event.data.shopAddress ?? "" }),
            footerLinks: getFooterLinks(languageCode),
        }
    })
    // .addTemplate({
    //     channelCode: "default",
    //     languageCode: LanguageCode.de,
    //     templateFile: "body.de.hbs",
    //     subject: "Betreff DE",
    // })
    .setMockEvent(mockAccountRegistrationEvent)

export const passwordResetHandler = new EmailEventListener("password-reset")
    .on(PasswordResetEvent)
    .loadData(async ({ event, injector }) => {
        const shopAddress = await getAddress(event.ctx, injector)
        return { shopAddress }
    })
    .setRecipient((event) => event.user.identifier)
    .setFrom("{{ mailSender }}")
    .setSubject((event) => {
        return translateRoot("passwordReset.subject", event.ctx.languageCode)
    })
    .setTemplateVars((event) => {
        const languageCode = event.ctx.languageCode
        const t = translate("passwordReset", languageCode)
        return {
            passwordResetToken: event.user.getNativeAuthenticationMethod().passwordResetToken,
            title: t("title"),
            text: t("text"),
            buttonText: t("buttonText"),
            info: t("info"),
            footerText: applyShopPlaceholders(i18next.t("footerText", { lng: "" + languageCode }), { _SHOP_ADDRESS_: event.data.shopAddress ?? "" }),
            footerLinks: getFooterLinks(languageCode),
        }
    })
    .setMockEvent(mockPasswordResetEvent)

export const emailAddressChangeHandler = new EmailEventListener("email-address-change")
    .on(IdentifierChangeRequestEvent)
    .loadData(async ({ event, injector }) => {
        const shopAddress = await getAddress(event.ctx, injector)
        return { shopAddress }
    })
    .setRecipient((event) => event.user.getNativeAuthenticationMethod().pendingIdentifier!)
    .setFrom("{{ mailSender }}")
    .setSubject((event) => {
        return translateRoot("emailAddressChange.subject", event.ctx.languageCode)
    })
    .setTemplateVars((event) => {
        const languageCode = event.ctx.languageCode
        const t = translate("emailAddressChange", languageCode)
        return {
            identifierChangeToken: event.user.getNativeAuthenticationMethod().identifierChangeToken,
            title: t("title"),
            text: t("text"),
            buttonText: t("buttonText"),
            info: t("info"),
            footerText: applyShopPlaceholders(i18next.t("footerText", { lng: "" + languageCode }), { _SHOP_ADDRESS_: event.data.shopAddress ?? "" }),
            footerLinks: getFooterLinks(languageCode),
        }
    })
    .setMockEvent(mockEmailAddressChangeEvent)

export const customEmailHandlers: Array<EmailEventHandler<any, any>> = [orderConfirmationHandler, emailVerificationHandler, passwordResetHandler, emailAddressChangeHandler, sendShippingHandler, sendVoucherHandler, lowStockHandler]
