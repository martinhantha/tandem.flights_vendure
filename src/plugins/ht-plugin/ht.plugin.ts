import { EntityHydrator, EventBus, HistoryEntryEvent, I18nService, LanguageCode, Logger, OrderEvent, OrderLineEvent, OrderPlacedEvent, OrderService, OrderStateTransitionEvent, PaymentStateTransitionEvent, PluginCommonModule, ProcessContext, TransactionalConnection, Type, VendurePlugin, StockMovementEvent } from "@vendure/core"
import * as path from "path"
import { CronJob } from "cron"
import { loggerCtx } from "./constants"
import { OrderCounter } from "./entities/orderCounter/entity"
import { HtSchema } from "./entities/schema"
import { HtSchemaAdmin } from "./entities/schema-admin"
import { Textblock } from "./entities/textblock/entity"
import { TextblockTranslation } from "./entities/textblock/translation.entity"
import { CustomOrderCodeStrategy } from "./entities/order/custom-order-code-strategy"
import { textblockPermission } from "./entities/textblock/permission"
import { OverrideAdminOrderResolver } from "./entities/order/admin-order.resolver"
import { MyOrderService } from "./entities/order/shop-order.service"
import { OverrideShopOrderResolver } from "./entities/order/shop-order.resolver"
import { TextblockAdminResolver } from "./entities/textblock/resolver"
import { TextblockService } from "./entities/textblock/service"
import { SearchResultResolver } from "./search/search-result.resolver"
import { MyCollectionResolver } from "./entities/collection/collection.resolver"
import { MyCollectionService } from "./entities/collection/collection.service"
import { Bestseller } from "./entities/bestseller/entity"
import { BestsellerService } from "./entities/bestseller/service"
import { BestsellerAdminResolver } from "./entities/bestseller/resolver"
import { bestsellerPermission } from "./entities/bestseller/permission"
import { UpdateBestsellerService } from "./jobs/update-bestseller"
import { flatRateCalculator } from "./shipping/flat-rate.calculator"
import { productDeliveryTime, productIsDigital, productMetaDescription, productMetaTitle, productRelatedProducts, productShortDescription, productSold, productSorting, productUsps } from "./custom-fields/product"
import { addressSdi, addressTaxnumber } from "./custom-fields/address"
import { collectionIsProductVariantsOverview, collectionMetaDescription, collectionMetaTitle } from "./custom-fields/collection"
import { customerIsBusiness, customerExtendedInfo, customerMarketing, customerPreferredLanguage } from "./custom-fields/customer"
import { customerSepaFields } from "./custom-fields/customer-sepa"
import { CustomerSepaService } from "./entities/customer/customer-sepa.service"
import { CustomerSepaShopResolver } from "./entities/customer/shop-customer-sepa.resolver"
import { facetValueDisplayName, facetValueFilterableInList, facetValueSorting } from "./custom-fields/facet-value"
import { globalSettingsOrderEmailCopyTo, globalSettingsLowStockEmailTo, globalSettingsLowStockThreshold } from "./custom-fields/global-settings"
import { orderIpAddress, orderLanguageCode, orderSelectedPaymentMethodCode, orderWithdrawalCount } from "./custom-fields/order"
import { paymentMethodEmailText, paymentMethodSorting } from "./custom-fields/payment-method"
import { productVariantAvailabilityInfoText, productVariantBestseller, productVariantHiddenInOverview, productVariantIsVoucher, productVariantNovelty, productVariantSold, productVariantSorting, productVariantLowStockThreshold } from "./custom-fields/product-variant"
import { productSortingNormalizeTask } from "./tasks/product-sorting-normalize-task"
import { productOptionSorting } from "./custom-fields/product-option"
import { countryBasedCalculator } from "./shipping/country-based.calculator"
import { FreeShippingResolver } from "./shipping/free-shipping.resolver"
import { CustomOrderConfirmationEvent } from "./event/custom-order-configuration-event"
import { SendShippingEvent } from "./event/send-shipping-event"
import { facetFilter, facetSorting } from "./custom-fields/facet"
import { digitalShippingEligibilityChecker } from "./shipping/digital-shipping-eligibility-checker"
import { notDigitalShippingEligibilityChecker } from "./shipping/not-digital-shipping-eligibility-checker"
import { returningCustomerPaymentEligibilityChecker } from "./payment/returning-customer-payment-eligibility-checker"
import { orderLineVoucher, orderLineDiscountPercent } from "./custom-fields/order-line"
import { Voucher } from "./entities/voucher/entity"
import { VoucherService } from "./entities/voucher/service"
import { CustomSettings } from "./entities/customSettings/entity"
import { CustomSettingsAdminResolver } from "./entities/customSettings/resolver"
import { CustomSettingsService } from "./entities/customSettings/service"
import { customSettingsPermission } from "./entities/customSettings/permission"
import { SendVoucherEvent } from "./event/send-voucher-event"
import { VoucherShopResolver } from "./entities/voucher/resolver"
import { voucherPermission } from "./entities/voucher/permission"
import { productVariantPriceReferencePrice } from "./custom-fields/product-variant-price"
import { ProductVariantEntityResolver } from "./entities/productVariant/resolver"
import { manualSettlementPaymentHandler } from "./handler/manual-settlement-payment-handler"
import { sepaDirectDebitPaymentHandler } from "./handler/sepa-dd-payment-handler"
import { selectedPaymentMethodCondition } from "./promotions/selected-payment-method.condition"
import { manualLineDiscount } from "./promotions/manual-line-discount-action"
import { orderHasLinesCondition } from "./promotions/order-has-lines.condition"
import { AssetCacheMaintenanceService } from "./services/asset-cache-maintenance.service"
import { ToolsAdminResolver } from "./entities/tools/resolver"
import { CollectionMenuRedisCacheService } from "./services/collection-menu-redis-cache.service"
import { shippingMethodSorting } from "./custom-fields/shipping-method"
import { LowStockService } from "./services/low-stock.service"
import { ensureProductSearchIndexes, patchProductServiceFindAll } from "./services/product-admin-search"

export interface HtPluginOptions {
    /**
     * Registers the manual-settlement (bank transfer) and SEPA direct debit payment handlers.
     * Default true. tandem.flights only offers PayPal + Stripe, so it passes false.
     */
    registerManualPaymentHandlers?: boolean
}

@VendurePlugin({
    imports: [PluginCommonModule],
    providers: [MyOrderService, { provide: OrderService, useExisting: MyOrderService }, TextblockService, MyCollectionService, BestsellerService, UpdateBestsellerService, VoucherService, CustomSettingsService, AssetCacheMaintenanceService, CollectionMenuRedisCacheService, LowStockService, CustomerSepaService],
    entities: [Textblock, TextblockTranslation, OrderCounter, Bestseller, Voucher, CustomSettings],
    adminApiExtensions: {
        schema: HtSchemaAdmin,
        resolvers: [OverrideAdminOrderResolver, TextblockAdminResolver, BestsellerAdminResolver, CustomSettingsAdminResolver, VoucherShopResolver, ProductVariantEntityResolver, ToolsAdminResolver],
    },
    shopApiExtensions: {
        schema: HtSchema,
        resolvers: [OverrideShopOrderResolver, TextblockAdminResolver, BestsellerAdminResolver, SearchResultResolver, MyCollectionResolver, VoucherShopResolver, ProductVariantEntityResolver, FreeShippingResolver, CustomerSepaShopResolver],
    },
    configuration: (config) => {
        // Plugin-specific configuration
        // such as custom fields, custom permissions,
        // strategies etc. can be configured here by
        // modifying the `config` object.

        config.customFields.Product.push(productMetaTitle, productMetaDescription, productShortDescription, productSorting, productIsDigital, productUsps, productDeliveryTime, productRelatedProducts, productSold)
        config.customFields.ProductVariant.push(productVariantSorting, productVariantHiddenInOverview, productVariantBestseller, productVariantNovelty, productVariantIsVoucher, productVariantAvailabilityInfoText, productVariantLowStockThreshold, productVariantSold)
        config.customFields.ProductOption.push(productOptionSorting)
        config.customFields.Customer.push(customerExtendedInfo, customerMarketing, customerIsBusiness, customerPreferredLanguage, ...customerSepaFields)
        config.customFields.Address.push(addressSdi, addressTaxnumber)
        config.customFields.GlobalSettings.push(globalSettingsOrderEmailCopyTo, globalSettingsLowStockEmailTo, globalSettingsLowStockThreshold)
        config.customFields.Order.push(orderLanguageCode, orderSelectedPaymentMethodCode, orderWithdrawalCount, orderIpAddress)
        config.customFields.OrderLine.push(orderLineVoucher, orderLineDiscountPercent)
        config.customFields.Facet.push(facetFilter, facetSorting)
        config.customFields.FacetValue.push(facetValueDisplayName, facetValueFilterableInList, facetValueSorting)
        config.customFields.PaymentMethod.push(paymentMethodSorting, paymentMethodEmailText)
        config.customFields.ShippingMethod.push(shippingMethodSorting)
        config.customFields.ProductVariantPrice.push(productVariantPriceReferencePrice)
        config.customFields.Collection.push(collectionMetaTitle, collectionMetaDescription, collectionIsProductVariantsOverview)
        config.orderOptions.orderCodeStrategy = new CustomOrderCodeStrategy()
        config.shippingOptions.shippingEligibilityCheckers.push(digitalShippingEligibilityChecker, notDigitalShippingEligibilityChecker)
        config.paymentOptions.paymentMethodEligibilityCheckers = [...(config.paymentOptions.paymentMethodEligibilityCheckers ?? []), returningCustomerPaymentEligibilityChecker]
        if (HtPlugin.options.registerManualPaymentHandlers !== false) {
            config.paymentOptions.paymentMethodHandlers = [...(config.paymentOptions.paymentMethodHandlers ?? []), manualSettlementPaymentHandler, sepaDirectDebitPaymentHandler]
        }
        config.promotionOptions = config.promotionOptions ?? {}
        config.promotionOptions.promotionConditions = [...(config.promotionOptions.promotionConditions ?? []), selectedPaymentMethodCondition, orderHasLinesCondition]
        config.promotionOptions.promotionActions = [...(config.promotionOptions.promotionActions ?? []), manualLineDiscount]
        config.shippingOptions.shippingCalculators.push(flatRateCalculator, countryBasedCalculator)
        config.authOptions.customPermissions.push(textblockPermission, bestsellerPermission, customSettingsPermission, voucherPermission)
        config.schedulerOptions.tasks.push(productSortingNormalizeTask)
        return config
    },
    dashboard: "./dashboard/index.tsx",
    compatibility: "^3.0.0",
})
export class HtPlugin {
    static options: HtPluginOptions = {}
    private readonly translationDir = path.join(__dirname, "./translations")
    private readonly languages = [LanguageCode.de, LanguageCode.it, LanguageCode.en]

    constructor(
        private i18nService: I18nService,
        private processContext: ProcessContext,
        private updateBestseller: UpdateBestsellerService,
        private eventBus: EventBus,
        private entityHydrator: EntityHydrator,
        private voucherService: VoucherService,
        private orderService: OrderService,
        private lowStockService: LowStockService,
        private connection: TransactionalConnection,
    ) {}
    static init(options: HtPluginOptions = {}): Type<HtPlugin> {
        HtPlugin.options = options
        return HtPlugin
    }
    async onModuleInit() {
        this.eventBus.ofType(OrderEvent).subscribe(async (event) => {
            if (event.type !== "created") return
            const current = event.entity.customFields?.languageCode
            if (current && String(current).trim() !== "") return
            try {
                await this.orderService.updateCustomFields(event.ctx, event.entity.id, { languageCode: event.ctx.languageCode })
            } catch (error) {
                Logger.error(`Failed to auto-populate order languageCode: ${(error as Error)?.message}`, loggerCtx)
            }
        })
        this.eventBus.ofType(OrderPlacedEvent).subscribe(async (event) => {
            try {
                // The order's languageCode customField is seeded on `created`, but the user may
                // have switched languages between cart creation and submission. Capture the
                // request language at placement time so the confirmation email and downstream
                // documents (invoice, shipping, voucher) all use the same language.
                try {
                    const requestLang = event.ctx.languageCode
                    if (requestLang && event.order.customFields?.languageCode !== requestLang) {
                        await this.orderService.updateCustomFields(event.ctx, event.order.id, { languageCode: requestLang })
                        event.order.customFields.languageCode = requestLang
                    }
                } catch (error) {
                    Logger.error(`Failed to sync order languageCode on placed: ${(error as Error)?.message}`, loggerCtx)
                }
                const success = await this.voucherService.useVoucherByOrder(event.ctx, event.order)
                if (!success) {
                    Logger.error("Failed to use voucher by order", loggerCtx)
                }
                this.eventBus.publish(new CustomOrderConfirmationEvent(event.ctx, event.order))
            } catch (error) {
                // JSON.stringify of an Error is "{}", its message and stack are not enumerable
                Logger.error(`OrderPlacedEvent failed for order ${event.order.code}: ${(error as Error)?.message}`, loggerCtx, (error as Error)?.stack)
            }
        })
        this.eventBus.ofType(OrderLineEvent).subscribe(async (event) => {})
        this.eventBus.ofType(HistoryEntryEvent).subscribe(async (event) => {})
        this.eventBus.ofType(PaymentStateTransitionEvent).subscribe(async (event) => {
            if (event.toState === "Settled") {
                await this.entityHydrator.hydrate(event.ctx, event.order, { relations: ["payments", "customer", "lines"] })
                // per line, so the hydrator never re-reads and merges order.lines from the database
                for (const line of event.order.lines ?? []) {
                    await this.entityHydrator.hydrate(event.ctx, line, { relations: ["productVariant.product"] })
                }

                if (event.order.payments.find((payment) => payment.method === "banktransfer" && payment.state === "Settled") && event.order.lines.some((line) => line.productVariant?.product?.customFields?.isDigital)) {
                    this.eventBus.publish(new SendVoucherEvent(event.ctx, event.order))
                }
            }
        })
        // order shipped
        this.eventBus.ofType(OrderStateTransitionEvent).subscribe(async (event) => {
            Logger.debug(`Order ${event.order.code}: ${event.fromState} -> ${event.toState}`, loggerCtx)
            if (event.toState === "Shipped") {
                this.eventBus.publish(new SendShippingEvent(event.ctx, event.order))
            }
        })
        // low stock alert: fires once, at the moment the saleable stock drops to or below the threshold
        this.eventBus.ofType(StockMovementEvent).subscribe(async (event) => {
            await this.lowStockService.checkStockMovements(event.ctx, event.stockMovements)
        })
    }
    async onApplicationBootstrap() {
        // faster admin product search for shops with many products (see services/product-admin-search.ts)
        patchProductServiceFindAll(this.connection)
        if (this.processContext.isServer) {
            // in the background: building the indexes the first time can take a while on big catalogs
            void ensureProductSearchIndexes(this.connection)
        }

        this.languages.forEach((language) => {
            this.i18nService.addTranslationFile(language, path.join(this.translationDir, `/${language}.json`))
        })
        if (this.processContext.isServer) {
            const job1 = new CronJob("0 5 2 * * *", async () => {
                // 5 min nach 12 Uhr
                await this.updateBestseller.updateBestseller({})
            })
            job1.start()
        }
    }
}
