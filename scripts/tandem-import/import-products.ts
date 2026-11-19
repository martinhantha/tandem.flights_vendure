/**
 * Imports the 7 voucher products of the old TYPO3 shop (tx_extshop_domain_model_product) with the
 * hantha-importer services (same pattern as src/importer.ts of the other hantha shops).
 *
 *   yarn tandem:import-products --dump /path/to/tandema_db0.sql [--dry-run]
 *
 * Idempotent: products are matched by slug (de), variants by sku and updated on a re-run.
 * Title images are taken from scripts/tandem-import/assets/products/<normalized filename> (see TANDEM.md).
 */
import "dotenv/config"
import { existsSync } from "fs"
import path from "path"
import { LanguageCode } from "@vendure/core"
import { config } from "../../src/vendure-config"
import * as importer from "../../src/plugins/hantha-importer"
import { updateProductVariantMapper } from "../../src/plugins/hantha-importer/mapper"
import { getDumpPath, hasFlag } from "./lib/args"
import { LANGS, LegacyProduct, normalizeAssetFilename, readLegacyProducts } from "./lib/legacy-data"
import { SqlDump } from "./lib/sql-dump"

const channelId = 1
const defaultLanguageCode = LanguageCode.de
const assetsRootPath = path.join(__dirname, "assets/products")
const TAX_CATEGORY_NAME = "Standard Tax"

function slugify(value: string): string {
    return value
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/ß/g, "ss")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
}

/** one "CSV row" in the column format of the hantha-importer */
function toRow(product: LegacyProduct): Record<string, string> {
    const imageFile = product.titleImage ? normalizeAssetFilename(product.titleImage) : ""
    const row: Record<string, string> = {
        "product:enabled": String(product.enabled),
        "asset:filenames": imageFile && existsSync(path.join(assetsRootPath, imageFile)) ? imageFile : "",
        "productVariant:sku": product.sku,
        "productVariant:price": String(product.price),
        "productVariant:enabled": String(product.enabled),
        "productVariant:trackInventory": "false",
        "taxCategory:name": TAX_CATEGORY_NAME,
    }
    for (const lang of LANGS) {
        // the hidden variants get the sku in the slug, their names are not unique
        const slugBase = product.enabled ? product.name[lang] : `${product.name[lang]}-${product.sku}`
        row[`product:name:${lang}`] = product.name[lang]
        row[`product:slug:${lang}`] = slugify(slugBase)
        row[`product:description:${lang}`] = product.description[lang]
        row[`product:customField:shortDescription:${lang}`] = product.shortDescription[lang]
    }
    return row
}

async function main() {
    const dryRun = hasFlag("dry-run")
    const products = readLegacyProducts(new SqlDump(getDumpPath()))
    const rows = products.map(toRow)

    console.log(`products: ${products.length} (enabled ${products.filter((p) => p.enabled).length}, disabled ${products.filter((p) => !p.enabled).length})`)
    console.log(`skus: ${products.map((p) => `${p.sku}${p.enabled ? "" : " (disabled)"} ${p.price}€`).join(", ")}`)
    const images = Array.from(new Set(products.map((p) => p.titleImage).filter((f): f is string => !!f)))
    const missing = images.filter((file) => !existsSync(path.join(assetsRootPath, normalizeAssetFilename(file))))
    console.log(`title images: ${images.length}, missing in assets/products: ${missing.length}`)
    missing.forEach((file) => console.log(`  missing: ${normalizeAssetFilename(file)}  (old fileadmin/user_upload/${file})`))
    if (dryRun) return

    const { getProductsWithUniqueSlugs, filterColumns, getAssetFilenames, buildTranslations } = importer
    let data: Array<any> = getProductsWithUniqueSlugs("product:slug", [LanguageCode.de, LanguageCode.it, LanguageCode.en], rows as any) as any

    // assets
    const assetFilenames = getAssetFilenames(data, "asset:filenames")
    if (assetFilenames.length) {
        const assetImporter = await importer.AssetImporterService.create(config, { channel: channelId, assetsRootPath, filenameField: "filename" })
        await assetImporter.importAssets(assetFilenames.map((filename) => ({ filename })) as any)
        data = await assetImporter.addAssetIds(data, "asset:ids", "asset:filenames")
        await assetImporter.close()
    }

    // products
    const shortDescriptionMapper = (row: any) =>
        buildTranslations(row, ["customField:shortDescription"], (row: any, lang) => ({
            languageCode: lang as LanguageCode,
            customFields: { shortDescription: row[`customField:shortDescription:${lang}`]?.trim() || "" },
        })) as any
    const productImporter = await importer.ProductImporterService.create(config, {
        channel: channelId,
        mainSlugField: `slug:${defaultLanguageCode}`,
        customFieldMappers: [() => ({ isDigital: true })],
        customFieldTranslationMappers: [shortDescriptionMapper],
    })
    await productImporter.importProducts(filterColumns(data, "product:", ["asset:ids"]) as any)
    data = (await productImporter.addProductIds(data as any, "product:id", `product:slug:${defaultLanguageCode}`)) as any
    await productImporter.close()

    // tax category
    const taxImporter = await importer.TaxCategoryImporterService.create(config, { channel: channelId })
    data = await taxImporter.addTaxCategoryIds(data as any, "taxCategory:id", "taxCategory:name")
    await taxImporter.close()

    // variants: one per product, voucher flag set
    const variantImporter = await importer.ProductVariantImporterService.create(config, {
        channel: channelId,
        customFieldMappers: [() => ({ isVoucher: true })],
        // the default update mapper takes "140" as 140 cents (the create mapper multiplies by 100) - fix it here
        customUpdateMapper: (id, row, customFieldMappers, customFieldTranslationMappers) => {
            const input = updateProductVariantMapper(id, row, customFieldMappers, customFieldTranslationMappers)
            if (input && row["price"]) input.price = Math.round(parseFloat(String(row["price"]).replace(",", ".")) * 100)
            return input
        },
    })
    await variantImporter.importProductVariants(filterColumns(data, "productVariant:", ["product:name", "product:id", "taxCategory:id", "asset:ids"]) as any)
    await variantImporter.close()
}

main().then(
    () => process.exit(0),
    (error) => {
        console.error(error)
        process.exit(1)
    }
)
