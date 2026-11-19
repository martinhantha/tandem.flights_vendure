import { DefaultJobQueuePlugin, VendureConfig, LogLevel, DefaultSchedulerPlugin, LanguageCode } from "@vendure/core"
import bodyParser from "body-parser"
import { EmailPlugin, EmailPluginDevModeOptions, EmailPluginOptions, FileBasedTemplateLoader } from "@vendure/email-plugin"
import { HardenPlugin } from "@vendure/harden-plugin"
import { AssetServerPlugin, configureS3AssetStorage } from "@vendure/asset-server-plugin"
import "dotenv/config"
import path from "path"
import { HtPlugin } from "./plugins/ht-plugin/ht.plugin"
import { CustomTranslationsPlugin } from "./plugins/custom-translations-plugin/custom-translations.plugin"
import { CustomEmailPlugin } from "./plugins/custom-email-plugin/custom-email.plugin"
import { customEmailHandlers } from "./plugins/custom-email-plugin/handler/email-handlers"
import { ElasticsearchPlugin, createElasticsearchAdapter } from "@vendure-community/elasticsearch-plugin"
import { DashboardPlugin } from "@vendure/dashboard/plugin"
import { RateLimitPlugin } from "./plugins/rate-limit-plugin/rate-limit.plugin"
import { CustomLogger } from "./plugins/ht-plugin/handler/custom-logger"
import { OrderExportPlugin } from "@pinelab/vendure-plugin-order-export"
import { OrderExport } from "./plugins/ht-plugin/exports/order-export"
import { CustomAttributesPlugin } from "./plugins/custom-attributes/custom-attributes.plugin"
import { PaypalPaymentPlugin } from "./plugins/paypal-payment"
import { StripePlugin } from "@vendure-community/stripe-plugin"
import { TandemPlugin } from "./plugins/tandem-plugin/tandem.plugin"

const IS_DEV = process.env.APP_ENV === "dev"
const IS_LOCAL = process.env.APP_LOCAL === "true"
const serverPort = +process.env.PORT || 3001
// parseInt gives NaN (not undefined) for a missing value, and a NaN level silences every log including errors
const loggingLevel = parseInt("" + process.env.LOGGING_LEVEL)

const SHOP_NAME = process.env.SHOP_NAME || "Tandem Flights Sarntal"
const SHOP_EMAIL = process.env.SHOP_EMAIL || "info@tandem.flights"

const smtpPort = parseInt(process.env.SMTP_PORT || "587", 10)
const smtpSecure = process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : smtpPort === 465

// Browser origins allowed to call the APIs with credentials (comma separated). The dashboard is served
// from the backend host itself and needs no entry.
const DEFAULT_CORS_ORIGINS = ["https://www.tandem.flights", "https://tandem.flights", "https://cms.tandem.flights", "http://localhost:3000", "http://localhost:3001"]
const corsOrigins = (process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(",") : DEFAULT_CORS_ORIGINS).map((origin) => origin.trim()).filter(Boolean)

// SMTP credentials come from the environment only. Without SMTP_HOST the mails are written to
// static/email/test-emails and can be viewed at http://localhost:3001/mailbox (local development).
const emailTransportOptions: Pick<EmailPluginOptions, "transport"> | Pick<EmailPluginDevModeOptions, "devMode" | "outputPath"> = process.env.SMTP_HOST
    ? {
          transport: {
              type: "smtp",
              host: process.env.SMTP_HOST,
              port: smtpPort,
              // SMTP_SECURE=true: implicit TLS (465). false: plain connect + STARTTLS (587, e.g. Aruba smtps.aruba.it)
              secure: smtpSecure,
              // never fall back to an unencrypted connection when STARTTLS is used
              requireTLS: !smtpSecure && (process.env.SMTP_REQUIRE_TLS ?? "true") !== "false",
              auth: {
                  user: process.env.SMTP_USER ?? "",
                  pass: process.env.SMTP_PASSWORD ?? "",
              },
          },
      }
    : {
          devMode: true,
          outputPath: path.join(__dirname, "../static/email/test-emails"),
      }

export const config: VendureConfig = {
    // tandem.flights: German is the default, Italian and English are available (see populate.ts / TANDEM.md)
    defaultLanguageCode: LanguageCode.de,
    logger: new CustomLogger({
        level: Number.isNaN(loggingLevel) ? LogLevel.Info : loggingLevel,
    }),
    apiOptions: {
        port: serverPort,
        adminApiPath: "admin-api",
        shopApiPath: "shop-api",
        // the vendure-auth-token header is added to exposedHeaders by Vendure (bearer token method)
        cors: {
            origin: corsOrigins,
            credentials: true,
        },
        middleware: [
            {
                route: "*splat",
                handler: (req: any, res: any, next: any) => {
                    // Skip JSON parsing for the Stripe webhook; it needs the raw body for signature verification (handled by StripePlugin's rawBodyMiddleware).
                    if (req.originalUrl === "/payments/stripe") return next()
                    return bodyParser.json({ limit: "10mb" })(req, res, next)
                },
                beforeListen: true,
            },
            {
                route: "",
                handler: (req: any, res: any, next: any) => {
                    req.app.set("trust proxy", true)
                    next()
                },
            },
        ],
        // The following options are useful in development mode,
        // but are best turned off for production for security
        // reasons.
        ...(IS_DEV
            ? {
                  adminApiPlayground: {
                      settings: { "request.credentials": "include" },
                  },
                  adminApiDebug: true,
                  shopApiPlayground: {
                      settings: { "request.credentials": "include" },
                  },
                  shopApiDebug: true,
              }
            : {}),
    },
    authOptions: {
        tokenMethod: ["bearer", "cookie"],
        superadminCredentials: {
            identifier: process.env.SUPERADMIN_USERNAME,
            password: process.env.SUPERADMIN_PASSWORD,
        },
        cookieOptions: {
            secret: process.env.COOKIE_SECRET,
        },
        sessionDuration: "30d",
    },
    dbConnectionOptions: {
        type: "postgres",
        // See the README.md "Migrations" section for an explanation of
        // the `synchronize` and `migrations` options.
        synchronize: true,
        migrationsRun: false, // <- wichtig
        migrations: [path.join(__dirname, "./migrations/*.+(js|ts)")],
        logging: false,
        database: process.env.DB_NAME,
        schema: process.env.DB_SCHEMA,
        host: process.env.DB_HOST,
        port: +process.env.DB_PORT,
        username: process.env.DB_USERNAME,
        password: process.env.DB_PASSWORD,
    },
    paymentOptions: {
        // tandem.flights: only PayPal ("paypal", PaypalPaymentPlugin) and Stripe ("stripe", StripePlugin) - both plugins register their handler themselves
        paymentMethodHandlers: [],
    },
    // When adding or altering custom field definitions, the database will
    // need to be updated. See the "Migrations" section in README.md.
    customFields: {},
    plugins: [
        AssetServerPlugin.init({
            route: "assets",
            assetUploadDir: path.join(__dirname, "../static/assets"),
            assetUrlPrefix: (IS_LOCAL ? process.env.APP_URL_DEV + ":3001" : IS_DEV ? process.env.APP_URL_DEV : process.env.APP_URL_PROD) + "/assets/",
            storageStrategyFactory: IS_LOCAL
                ? undefined
                : configureS3AssetStorage({
                      bucket: process.env.AWS_BUCKET || "",
                      credentials: {
                          accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
                          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
                      },
                      nativeS3Configuration: {
                          credentials: {
                              accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                              secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
                          },
                          region: process.env.AWS_REGION,
                          params: {
                              Bucket: process.env.AWS_BUCKET,
                          },
                          endpoint: process.env.AWS_ENDPOINT,
                      },
                  }),
            cacheHeader: {
                maxAge: 60 * 60, // 1 Hour
            },
        }),
        DefaultSchedulerPlugin.init({}),
        DefaultJobQueuePlugin.init({ useDatabaseForBuffer: true, cleanJobsSchedule: (cron) => cron.every(2).hours() }),
        // RateLimitPlugin,
        EmailPlugin.init({
            route: "mailbox",
            handlers: customEmailHandlers,
            templateLoader: new FileBasedTemplateLoader("static/email/templates"),
            globalTemplateVars: {
                // The following variables will change depending on your storefront implementation.
                // Here we are assuming a storefront running at http://localhost:8080.
                mailSender: `"${SHOP_NAME}" <${SHOP_EMAIL}>`,
                verifyEmailAddressUrl: (IS_DEV ? process.env.SHOP_URL_DEV : process.env.SHOP_URL_PROD) + "/account/verify",
                passwordResetUrl: (IS_DEV ? process.env.SHOP_URL_DEV : process.env.SHOP_URL_PROD) + "/account/password-reset",
                changeEmailAddressUrl: (IS_DEV ? process.env.SHOP_URL_DEV : process.env.SHOP_URL_PROD) + "/account/change-email-address",
                fontFamily: "Helvetica, Arial, sans-serif",
                colorFont: "#1d1e1c",
                colorCta: "#a8c714",
                colorBackgroundDark: "#1d1e1c",
                white: "#FFFFFF",
                border: "1px solid #E0E0E0",
                borderColor: "#E0E0E0",
                shopEmail: SHOP_EMAIL,
                shopPhone: process.env.SHOP_PHONE || "+39 379 280 6070",
                shopUrl: IS_DEV ? process.env.SHOP_URL_DEV : process.env.SHOP_URL_PROD,
                shopAdminUrl: IS_LOCAL ? process.env.APP_URL_DEV + ":3001" : IS_DEV ? process.env.APP_URL_DEV : process.env.APP_URL_PROD,
            },
            ...emailTransportOptions,
        }),

        HardenPlugin.init({
            maxQueryComplexity: 100000,
            apiMode: IS_DEV ? "dev" : "prod",
        }),
        CustomEmailPlugin,
        CustomTranslationsPlugin,
        // no bank transfer / SEPA for tandem.flights
        HtPlugin.init({ registerManualPaymentHandlers: false }),
        TandemPlugin,
        ElasticsearchPlugin.init({
            adapter: () =>
                createElasticsearchAdapter({
                    host: IS_LOCAL ? "http://localhost" : "http://elasticsearch",
                    port: IS_LOCAL ? 9201 : 9200,
                }),
            indexPrefix: "vendure",
            bufferUpdates: false, // wichtig, damit die Updates sofort in Elasticsearch landen
            // relevance: a match in the product title ranks highest
            searchConfig: {
                multiMatchType: "best_fields",
                boostFields: {
                    productName: 5,
                    productVariantName: 3,
                    sku: 2,
                    description: 1,
                },
            },
            // Substring matching for German compound words, e.g. searching
            // "Socken" should match the product title "Schafwollsocken".
            // n-grams are generated at index time; the query stays a whole word
            // (search_analyzer) so it is matched against the indexed substrings.
            // NOTE: changing index settings/mappings recreates the indices —
            // a full reindex is required afterwards.
            indexSettings: {
                index: {
                    max_ngram_diff: 18,
                },
                analysis: {
                    filter: {
                        ngram_filter: {
                            type: "ngram",
                            min_gram: 3,
                            max_gram: 20,
                        },
                    },
                    analyzer: {
                        ngram_analyzer: {
                            type: "custom",
                            tokenizer: "standard",
                            filter: ["lowercase", "ngram_filter"],
                        },
                    },
                },
            },
            indexMappingProperties: {
                productName: {
                    type: "text",
                    analyzer: "ngram_analyzer",
                    search_analyzer: "standard",
                    fields: {
                        keyword: {
                            type: "keyword",
                            ignore_above: 256,
                        },
                    },
                },
            },
        }),
        DashboardPlugin.init({
            // Important: This must match the base path from vite.config.mts (without slashes)
            route: "dashboard",
            // Path to the Vite build output directory
            appDir: path.join(__dirname, "../dist/dashboard"),
        }),
        OrderExportPlugin.init({
            // Optionally add your own strategies here
            exportStrategies: [new OrderExport()],
        }),
        CustomAttributesPlugin.init({}),
        PaypalPaymentPlugin.init({
            enabled: true,
        }),
        // Stripe plugin
        // for local development install stripe cli (+ login): https://docs.stripe.com/stripe-cli/install?install-method=windows#install
        // use the following command to generate local webhook signing secret: stripe listen --forward-to localhost:3001/payments/stripe
        // test credit cards: https://docs.stripe.com/payments/accept-a-payment?payment-ui=elements&api-integration=checkout#test-the-integration
        StripePlugin.init({
            // This prevents different customers from using the same PaymentIntent
            storeCustomersInStripe: true,
            // skip non-vendure payment intents
            skipPaymentIntentsWithoutExpectedMetadata: true,
        }),
    ],
}
