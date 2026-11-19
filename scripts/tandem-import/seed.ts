/**
 * Idempotent base setup of the tandem.flights shop. Run after `yarn populate` (countries, zones, taxes):
 *
 *   yarn tandem:seed [--force-texts] [--force-template] [--update-payment]
 *
 * - global settings: languages de/it/en, order mail copy to info@tandem.flights
 * - default channel: de default + it/en, EUR, prices include tax
 * - shipping method "digital" (free, only for orders with digital products = vouchers)
 * - payment methods "paypal" and "stripe" (credentials from env, disabled while they are missing)
 * - textblocks (voucher + mail texts), pdfme voucher template ("voucher-template"), PDF font
 *
 * Existing textblocks / template / payment credentials are not overwritten without the --force-* / --update-* flags.
 */
import "dotenv/config"
import { readFileSync } from "fs"
import {
    bootstrapWorker,
    ChannelService,
    ConfigService,
    CurrencyCode,
    GlobalSettingsService,
    LanguageCode,
    PaymentMethodService,
    RequestContext,
    ShippingMethodService,
    TransactionalConnection,
} from "@vendure/core"
import { config } from "../../src/vendure-config"
import { getSuperadminContext } from "../../src/plugins/hantha-importer"
import { TextblockService } from "../../src/plugins/ht-plugin/entities/textblock/service"
import { Textblock } from "../../src/plugins/ht-plugin/entities/textblock/entity"
import { CustomSettings } from "../../src/plugins/ht-plugin/entities/customSettings/entity"
import { hasFlag } from "./lib/args"
import { buildVoucherTemplate, FONT_ASSET_PATH, FONT_FILE } from "./lib/voucher-template"
import { MAIL_TEXTBLOCKS, VOUCHER_TEXTBLOCKS } from "./voucher-template/textblocks"
import { IsNull } from "typeorm"

const LANGUAGES = [LanguageCode.de, LanguageCode.it, LanguageCode.en]
const ORDER_COPY_EMAIL = process.env.SHOP_ORDER_COPY_EMAIL || "info@tandem.flights"
// placeholder for required handler args while the credentials are missing (the method is created disabled)
const NOT_CONFIGURED = "not-configured"

async function main() {
    const { app } = await bootstrapWorker(config)
    try {
        const ctx = await getSuperadminContext(app)
        await seedSettingsAndChannel(app, ctx)
        await seedShippingMethod(app, ctx)
        await seedPaymentMethods(app, ctx)
        await seedTextblocks(app, ctx)
        await seedVoucherTemplate(app, ctx)
        await seedFont(app)
    } finally {
        await app.close()
    }
}

type App = Awaited<ReturnType<typeof bootstrapWorker>>["app"]

async function seedSettingsAndChannel(app: App, ctx: RequestContext) {
    await app.get(GlobalSettingsService).updateSettings(ctx, {
        availableLanguages: LANGUAGES,
        customFields: { orderEmailCopyTo: ORDER_COPY_EMAIL },
    })
    const channelService = app.get(ChannelService)
    const channel = await channelService.getDefaultChannel(ctx)
    await channelService.update(ctx, {
        id: channel.id,
        defaultLanguageCode: LanguageCode.de,
        availableLanguageCodes: LANGUAGES,
        defaultCurrencyCode: CurrencyCode.EUR,
        availableCurrencyCodes: [CurrencyCode.EUR],
        // the old shop's prices are gross prices (Italian VAT 22 % included)
        pricesIncludeTax: true,
    })
    console.log("global settings + default channel: de/it/en, EUR, prices incl. tax")
}

async function seedShippingMethod(app: App, ctx: RequestContext) {
    const service = app.get(ShippingMethodService)
    const existing = (await service.findAll(ctx, { filter: { code: { eq: "digital" } } })).items[0]
    if (existing) return console.log("shipping method 'digital' exists")
    await service.create(ctx, {
        code: "digital",
        fulfillmentHandler: "manual-fulfillment",
        checker: { code: "digital-shipping-eligibility-checker", arguments: [] },
        calculator: {
            code: "default-shipping-calculator",
            arguments: [
                { name: "rate", value: "0" },
                { name: "includesTax", value: "auto" },
                { name: "taxRate", value: "0" },
            ],
        },
        translations: [
            { languageCode: LanguageCode.de, name: "Gutschein per E-Mail", description: "" },
            { languageCode: LanguageCode.it, name: "Buono via e-mail", description: "" },
            { languageCode: LanguageCode.en, name: "Voucher by e-mail", description: "" },
        ],
    })
    console.log("shipping method 'digital' created")
}

async function seedPaymentMethods(app: App, ctx: RequestContext) {
    const service = app.get(PaymentMethodService)
    const update = hasFlag("update-payment")
    const methods = [
        {
            code: "paypal",
            names: { de: "PayPal", it: "PayPal", en: "PayPal" },
            hasCredentials: !!(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_SECRET),
            handler: {
                code: "paypal",
                arguments: [
                    { name: "clientId", value: process.env.PAYPAL_CLIENT_ID || NOT_CONFIGURED },
                    { name: "secret", value: process.env.PAYPAL_SECRET || NOT_CONFIGURED },
                    { name: "sandbox", value: String((process.env.PAYPAL_MODE ?? "sandbox") !== "live") },
                    { name: "brandName", value: process.env.SHOP_NAME || "Tandem Flights Sarntal" },
                    { name: "cancelPath", value: process.env.PAYPAL_CANCEL_PATH || "checkout" },
                    { name: "returnPath", value: process.env.PAYPAL_RETURN_PATH || "checkout/success" },
                ],
            },
        },
        {
            code: "stripe",
            names: { de: "Kreditkarte", it: "Carta di credito", en: "Credit card" },
            hasCredentials: !!(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET),
            handler: {
                code: "stripe",
                arguments: [
                    { name: "apiKey", value: process.env.STRIPE_SECRET_KEY || NOT_CONFIGURED },
                    { name: "webhookSecret", value: process.env.STRIPE_WEBHOOK_SECRET || NOT_CONFIGURED },
                ],
            },
        },
    ]
    for (const method of methods) {
        const translations = LANGUAGES.map((languageCode) => ({ languageCode, name: method.names[languageCode as "de" | "it" | "en"], description: "" }))
        const existing = (await service.findAll(ctx, { filter: { code: { eq: method.code } } })).items[0]
        if (!existing) {
            await service.create(ctx, { code: method.code, enabled: method.hasCredentials, handler: method.handler, translations })
            console.log(`payment method '${method.code}' created (${method.hasCredentials ? "enabled" : "disabled: credentials missing in env"})`)
        } else if (update) {
            await service.update(ctx, { id: existing.id, enabled: method.hasCredentials, handler: method.handler })
            console.log(`payment method '${method.code}' updated from env (${method.hasCredentials ? "enabled" : "disabled"})`)
        } else {
            console.log(`payment method '${method.code}' exists (use --update-payment to write the env credentials)`)
        }
    }
}

async function seedTextblocks(app: App, ctx: RequestContext) {
    const service = app.get(TextblockService)
    const repository = app.get(TransactionalConnection).getRepository(ctx, Textblock)
    const force = hasFlag("force-texts")
    let created = 0
    let updated = 0
    for (const [name, texts] of Object.entries({ ...VOUCHER_TEXTBLOCKS, ...MAIL_TEXTBLOCKS })) {
        const translations = LANGUAGES.map((languageCode) => ({ languageCode, description: texts[languageCode as "de" | "it" | "en"] }))
        const existing = await repository.findOne({ where: { name, deletedAt: IsNull() } })
        if (!existing) {
            await service.create(ctx, { name, enabled: true, translations })
            created++
        } else if (force) {
            await service.update(ctx, {
                id: String(existing.id),
                enabled: true,
                translations: translations.map((t) => {
                    const id = existing.translations.find((e) => e.languageCode === t.languageCode)?.id
                    return { ...t, id: id !== undefined ? String(id) : undefined }
                }),
            })
            updated++
        }
    }
    console.log(`textblocks: ${created} created, ${updated} updated`)
}

async function seedVoucherTemplate(app: App, ctx: RequestContext) {
    const repository = app.get(TransactionalConnection).getRepository(ctx, CustomSettings)
    const value = JSON.stringify(buildVoucherTemplate())
    const existing = await repository.findOne({ where: { name: "voucher-template", deletedAt: IsNull() } })
    if (!existing) {
        await repository.save(repository.create({ name: "voucher-template", value }))
        console.log("voucher-template created")
    } else if (hasFlag("force-template")) {
        await repository.update(existing.id, { value })
        console.log("voucher-template overwritten")
    } else {
        console.log("voucher-template exists (use --force-template to overwrite it)")
    }
}

/** pdf-helper.ts loads the PDF font over HTTP from <asset url>/assets/fonts/roboto-regular.ttf */
async function seedFont(app: App) {
    const { assetStorageStrategy } = app.get(ConfigService).assetOptions
    if (await assetStorageStrategy.fileExists(FONT_ASSET_PATH)) return console.log("PDF font exists")
    await assetStorageStrategy.writeFileFromBuffer(FONT_ASSET_PATH, readFileSync(FONT_FILE))
    console.log(`PDF font uploaded to ${FONT_ASSET_PATH}`)
}

main().then(
    () => process.exit(0),
    (error) => {
        console.error((error as Error)?.message ?? error)
        process.exit(1)
    }
)
