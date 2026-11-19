import { LanguageCode, Logger, RequestContext, ShippingCalculator, TaxSetting } from "@vendure/core"

const loggerContext = "flat-rate-calculator"

export const flatRateCalculator = new ShippingCalculator({
    code: "flat-rate-calculator",
    description: [
        { languageCode: LanguageCode.en, value: "Standard flat rate shipping calculation" },
        { languageCode: LanguageCode.de, value: "Standard Versandkostenpauschale" },
        { languageCode: LanguageCode.it, value: "Calcolo standard delle spese di spedizione" },
    ],
    args: {
        rate: {
            type: "int",
            defaultValue: 0,
            ui: { component: "currency-form-input" },
            label: [
                { languageCode: LanguageCode.en, value: "Shipping price" },
                { languageCode: LanguageCode.de, value: "Versandkosten" },
                { languageCode: LanguageCode.it, value: "Spese di spedizione" },
            ],
        },
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
        taxRate: {
            type: "int",
            defaultValue: 0,
            ui: { component: "number-form-input", suffix: "%" },
            label: [
                { languageCode: LanguageCode.en, value: "Tax rate" },
                { languageCode: LanguageCode.de, value: "Steuersatz" },
                { languageCode: LanguageCode.it, value: "Aliquota fiscale" },
            ],
        },
        freeShippingFrom: {
            type: "int",
            defaultValue: 0,
            ui: { component: "currency-form-input" },
            label: [
                { languageCode: LanguageCode.en, value: "Free shipping from" },
                { languageCode: LanguageCode.de, value: "Gratis-Versand ab" },
                { languageCode: LanguageCode.it, value: "Spedizione gratuita da" },
            ],
        },
    },
    calculate: async (ctx, order, args) => {
        let total = 0

        for (const line of order.lines) {
            total += line.proratedLinePriceWithTax
        }

        if (args.freeShippingFrom > 0 && total >= args.freeShippingFrom) {
            return {
                price: 0,
                taxRate: args.taxRate,
                priceIncludesTax: getPriceIncludesTax(ctx, args.includesTax as any),
            }
        }

        return {
            price: args.rate,
            taxRate: args.taxRate,
            priceIncludesTax: getPriceIncludesTax(ctx, args.includesTax as any),
        }
    },
})

function getPriceIncludesTax(ctx: RequestContext, setting: TaxSetting): boolean {
    switch (setting) {
        case TaxSetting.auto:
            return ctx.channel.pricesIncludeTax
        case TaxSetting.exclude:
            return false
        case TaxSetting.include:
            return true
    }
}
