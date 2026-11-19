/**
 * Imports the vouchers of the old TYPO3 shop (tx_extshop_domain_model_coupon) into the ht-plugin
 * Voucher entity, so that printed codes keep working on the /qr page and in the dashboard.
 *
 *   yarn tandem:import-vouchers --dump /path/to/tandema_db0.sql [--dry-run]
 *
 * - idempotent: codes that already exist are skipped (codes are kept exactly as printed)
 * - deleted coupons are skipped
 * - only counts are printed: recipient / issuer names are personal data and go to the DB (`info`) only
 * - run the product import first, so shop vouchers can be linked to their product variant
 */
import "dotenv/config"
import { bootstrapWorker, ProductVariant, TransactionalConnection } from "@vendure/core"
import { config } from "../../src/vendure-config"
import { getSuperadminContext } from "../../src/plugins/hantha-importer"
import { Voucher } from "../../src/plugins/ht-plugin/entities/voucher/entity"
import { getDumpPath, hasFlag } from "./lib/args"
import { LEGACY_PRODUCT_ID_TO_SKU, LegacyCoupon, parsePriceText, readLegacyCoupons, readLegacyProducts } from "./lib/legacy-data"
import { SqlDump } from "./lib/sql-dump"

interface MappedVoucher {
    coupon: LegacyCoupon
    sku: string | null
    initialAmount: number | null
    amount: number | null
}

function mapCoupons(coupons: LegacyCoupon[], productPrices: Map<string, number>): MappedVoucher[] {
    return coupons.map((coupon) => {
        const sku = LEGACY_PRODUCT_ID_TO_SKU[coupon.productId] ?? null
        // the price text wins (hand-made vouchers), shop vouchers fall back to the product price
        const initialAmount = parsePriceText(coupon.priceText) ?? (sku ? productPrices.get(sku) ?? null : null)
        // a used voucher is fully redeemed: balance 0. Unknown value (e.g. "Gratis") stays null = not used.
        const amount = coupon.used ? 0 : initialAmount
        return { coupon, sku, initialAmount, amount }
    })
}

/** PERSONAL DATA - only written to the DB */
function buildInfo(coupon: LegacyCoupon): string {
    const parts = ["Import TYPO3"]
    if (coupon.info) parts.push(`Empfänger/Info: ${coupon.info}`)
    if (coupon.issuer) parts.push(`Ausgestellt von: ${coupon.issuer}`)
    if (coupon.priceText) parts.push(`Preis (alt): ${coupon.priceText}`)
    if (coupon.orderId) parts.push(`Bestellung (alt): ${coupon.orderId}/${coupon.nthProduct}`)
    return parts.join(" | ")
}

function printCounts(label: string, vouchers: MappedVoucher[]) {
    const now = Date.now()
    const count = (filter: (v: MappedVoucher) => boolean) => vouchers.filter(filter).length
    console.log(`${label}: ${vouchers.length}`)
    console.log(`  used (amount 0):              ${count((v) => v.coupon.used)}`)
    console.log(`  not used, still valid:        ${count((v) => !v.coupon.used && v.coupon.expiresAt.getTime() >= now)}`)
    console.log(`  not used, expired:            ${count((v) => !v.coupon.used && v.coupon.expiresAt.getTime() < now)}`)
    console.log(`  linked to a shop product:     ${count((v) => !!v.sku)}`)
    console.log(`  value known:                  ${count((v) => v.initialAmount !== null)}`)
    console.log(`  value unknown (amount null):  ${count((v) => v.initialAmount === null)}`)
}

async function main() {
    const dryRun = hasFlag("dry-run")
    const dump = new SqlDump(getDumpPath())
    const productPrices = new Map(readLegacyProducts(dump).map((p) => [p.sku, Math.round(p.price * 100)]))
    const coupons = readLegacyCoupons(dump)
    const duplicates = coupons.length - new Set(coupons.map((c) => c.code)).size
    const mapped = mapCoupons(coupons, productPrices)

    printCounts("coupons (not deleted)", mapped)
    console.log(`  duplicate codes in dump:      ${duplicates}`)
    if (dryRun) return

    const { app } = await bootstrapWorker(config)
    try {
        const ctx = await getSuperadminContext(app)
        const connection = app.get(TransactionalConnection)
        const voucherRepository = connection.getRepository(ctx, Voucher)

        const variantIds = new Map<string, string>()
        for (const sku of Object.values(LEGACY_PRODUCT_ID_TO_SKU)) {
            const variant = await connection.getRepository(ctx, ProductVariant).findOne({ where: { sku } })
            if (variant) variantIds.set(sku, String(variant.id))
        }
        if (variantIds.size < Object.keys(LEGACY_PRODUCT_ID_TO_SKU).length) {
            console.warn(`only ${variantIds.size} of ${Object.keys(LEGACY_PRODUCT_ID_TO_SKU).length} product variants found - run yarn tandem:import-products first to link all vouchers`)
        }

        const existing = new Set((await voucherRepository.find({ select: ["code"] })).map((v) => v.code))
        const toCreate = mapped.filter((v) => !existing.has(v.coupon.code))
        const seen = new Set<string>()
        let created = 0
        for (const { coupon, sku, amount, initialAmount } of toCreate) {
            if (seen.has(coupon.code)) continue
            seen.add(coupon.code)
            const voucher = new Voucher({
                code: coupon.code,
                info: buildInfo(coupon),
                product_id: sku ? variantIds.get(sku) : undefined,
                amount: amount as number,
                initialAmount: initialAmount as number,
                currencyCode: "EUR",
                validFrom: coupon.createdAt,
                validTo: coupon.expiresAt,
                nth_product_item: coupon.orderId ? coupon.nthProduct : undefined,
            })
            await voucherRepository.save(voucher)
            created++
        }
        console.log(`skipped (code exists): ${mapped.length - toCreate.length}`)
        console.log(`created: ${created}`)
    } finally {
        await app.close()
    }
}

main().then(
    () => process.exit(0),
    (error) => {
        // error messages from the DB may contain values - print only the message
        console.error((error as Error)?.message ?? error)
        process.exit(1)
    }
)
