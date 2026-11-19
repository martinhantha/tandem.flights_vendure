import { ShippingCalculator, LanguageCode, Logger, TaxSetting, RequestContext } from "@vendure/core"
import { EMPTY_SHIPPING_CONFIG, parseShippingConfig } from "./shipping-config"

export const countryBasedCalculator = new ShippingCalculator({
    code: "country-based-calculator",
    description: [
        { languageCode: LanguageCode.en, value: "Country-Based Shipping Calculator" },
        { languageCode: LanguageCode.de, value: "Länderbasierter Versandkostenrechner" },
        { languageCode: LanguageCode.it, value: "Calcolatore di spedizione basato sul paese" },
    ],
    args: {
        includesTax: {
            type: "string",
            defaultValue: TaxSetting.auto,
            ui: {
                component: "select-form-input",
                options: [
                    {
                        label: [
                            { languageCode: LanguageCode.en, value: "Includes tax" },
                            { languageCode: LanguageCode.de, value: "Enthält Steuern" },
                            { languageCode: LanguageCode.it, value: "Include tasse" },
                        ],
                        value: TaxSetting.include,
                    },
                    {
                        label: [
                            { languageCode: LanguageCode.en, value: "Excludes tax" },
                            { languageCode: LanguageCode.de, value: "Keine Steuern enthalten" },
                            { languageCode: LanguageCode.it, value: "Esclude tasse" },
                        ],
                        value: TaxSetting.exclude,
                    },
                    {
                        label: [
                            { languageCode: LanguageCode.en, value: "Auto (based on Channel)" },
                            { languageCode: LanguageCode.de, value: "Automatisch (basierend auf Kanal)" },
                            { languageCode: LanguageCode.it, value: "Auto (basato sul canale)" },
                        ],
                        value: TaxSetting.auto,
                    },
                ],
            },
            label: [
                { languageCode: LanguageCode.en, value: "Price includes tax" },
                { languageCode: LanguageCode.de, value: "Preis enthält Steuern" },
                { languageCode: LanguageCode.it, value: "Il prezzo include le tasse" },
            ],
        },
        shippingConfig: {
            type: "string",
            defaultValue: JSON.stringify(EMPTY_SHIPPING_CONFIG),
            ui: { component: "shipping-config-input" },
            label: [
                { languageCode: LanguageCode.en, value: "Shipping configuration" },
                { languageCode: LanguageCode.de, value: "Versandkonfiguration" },
                { languageCode: LanguageCode.it, value: "Configurazione spedizione" },
            ],
        },
    },
    calculate: (ctx, order, args) => {
        const config = parseShippingConfig(args.shippingConfig)
        const shippingAddress = order.shippingAddress
        const countryCode = shippingAddress?.countryCode?.toUpperCase() ?? ""
        const country = config.countries.find((c) => c.code.toUpperCase() === countryCode)

        let rate = country?.rate ?? config.defaultRate
        const freeShippingThreshold = country?.freeShipping ?? config.defaultFreeShipping
        const taxRate = country?.taxRate ?? config.defaultTaxRate

        if (freeShippingThreshold && order.subTotalWithTax >= freeShippingThreshold) {
            rate = 0
        }
        
        return {
            price: rate,
            taxRate,
            priceIncludesTax: resolvePriceIncludesTax(ctx, args.includesTax as any),
        }
    },
})

function resolvePriceIncludesTax(ctx: RequestContext, setting: TaxSetting): boolean {
    switch (setting) {
        case TaxSetting.auto:
            return ctx.channel.pricesIncludeTax
        case TaxSetting.exclude:
            return false
        case TaxSetting.include:
            return true
    }
}
