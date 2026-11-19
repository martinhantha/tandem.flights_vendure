/**
 * tandem.flights: creates countries, zones and tax rates in an empty database (no demo products).
 *   yarn populate
 * Afterwards: yarn tandem:seed, yarn tandem:import-products, yarn tandem:import-vouchers (see TANDEM.md).
 *
 * Taxes: the vouchers are for a service performed in Italy, so Italian VAT applies to every customer.
 * All countries get the same rates (Standard 22 %, Reduced 10 %, Zero 0 %); the channel's default
 * tax zone is "Europe" (incl. Italy) and the prices are entered gross (pricesIncludeTax, set by tandem:seed).
 */
import { populate } from "@vendure/core/cli"
import { bootstrap, LanguageCode } from "@vendure/core"
import { config } from "./vendure-config"

const vendureInitialData = require("@vendure/create/assets/initial-data.json")

const initialData = {
    ...vendureInitialData,
    defaultLanguage: LanguageCode.de,
    defaultZone: "Europe",
    taxRates: [
        { name: "Standard Tax", percentage: 22 },
        { name: "Reduced Tax", percentage: 10 },
        { name: "Zero Tax", percentage: 0 },
    ],
    // created by scripts/tandem-import/seed.ts with explicit codes
    shippingMethods: [],
    paymentMethods: [],
    collections: [],
}

populate(
    () =>
        bootstrap({
            ...config,
            dbConnectionOptions: { ...config.dbConnectionOptions, synchronize: true },
        }),
    initialData
).then((app) => app.close())
