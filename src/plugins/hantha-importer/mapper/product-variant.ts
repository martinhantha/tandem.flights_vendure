import { CreateProductVariantInput, GlobalFlag, LanguageCode, UpdateProductVariantInput } from "@vendure/common/lib/generated-types"
import { CustomCreateProductVariantMapper, CustomFieldMappers, CustomUpdateProductVariantMapper } from "../types"
import { addCustomFieldsToTranslations, buildTranslations, mergeTranslatedCustomFields } from "../utils"

export interface ProductVariantCsvRow {
    "product:id"?: string
    sku: string
    enabled?: string
    price: string
    "taxCategory:id": string
    trackInventory: string
    outOfStockThreshold: string
    stockOnHand: string
    useGlobalOutOfStockThreshold: string
    "option:ids": string
    "facetValue:ids": string
    "asset:ids": string
    [key: `product:name:${string}`]: string
    [key: `name:${string}`]: string
}

/**
 * Builds translations for all language codes present in the row for product variant fields.
 * @param row The CSV row to build translations from.
 * @returns An array of translation objects for each language code found in the row.
 */
const buildProductVariantTranslations = (row: any): Array<any> => {
    return buildTranslations(row, ["name", "product:name"], (row, lang) => ({
        languageCode: lang as LanguageCode,
        name: (() => {
            if (row[`name:${lang}`]) {
                return row[`name:${lang}`]?.trim() || ""
            }
            if (row[`product:name:${lang}`]) {
                return row[`product:name:${lang}`]?.trim() || ""
            }
            return ""
        })(),
    }))
}

/**
 * Maps a CSV row to a CreateProductVariantInput object.
 * @param productId The ID of the product to which the variant belongs.
 * @param row The CSV row to map.
 * @param customFieldMappers Optional array of custom field mappers.
 * @param customFieldTranslationMappers Optional array of custom field translation mappers.
 * @returns The mapped CreateProductVariantInput object, or null if the row is invalid.
 */
export const createProductVariantMapper: CustomCreateProductVariantMapper = (productId: string, row: ProductVariantCsvRow, customFieldMappers?: CustomFieldMappers, customFieldTranslationMappers?: CustomFieldMappers): CreateProductVariantInput | null => {
    const productVariant: CreateProductVariantInput = {
        productId,
        sku: row["sku"],
        translations: buildProductVariantTranslations(row),
    }

    if (row["price"]) {
        const priceFloat = parseFloat(row["price"].replace(",", "."))
        productVariant.price = Math.round(priceFloat * 100)
    }
    if (row["taxCategory:id"]) {
        productVariant.taxCategoryId = row["taxCategory:id"]
    }
    if (row["trackInventory"]) {
        productVariant.trackInventory = row["trackInventory"].toLocaleLowerCase() === "true" ? GlobalFlag.TRUE : GlobalFlag.FALSE
    }
    if (row["enabled"]) {
        productVariant.enabled = row["enabled"].toLocaleLowerCase() === "true"
    }
    if (row["outOfStockThreshold"]) {
        productVariant.outOfStockThreshold = parseInt(row["outOfStockThreshold"])
    }
    if (row["stockOnHand"]) {
        productVariant.stockOnHand = parseInt(row["stockOnHand"])
    }
    if (row["useGlobalOutOfStockThreshold"]) {
        productVariant.useGlobalOutOfStockThreshold = row["useGlobalOutOfStockThreshold"].toLocaleLowerCase() === "true"
    }
    if (row["option:ids"]) {
        const optionIds = row["option:ids"]
            .split(";")
            .map((option) => parseInt(option.trim()))
            .filter((id) => !!id)
        productVariant.optionIds = optionIds
    }
    if (row["facetValue:ids"]) {
        const facetValueIds = row["facetValue:ids"]
            .split(";")
            .map((id) => parseInt(id.trim()))
            .filter((id) => !!id)
        productVariant.facetValueIds = facetValueIds
    }
    if (row["asset:ids"]) {
        let assetIds: string[] = []

        // split by ';' for individual asset IDs
        assetIds = row["asset:ids"].split(";")

        // trim whitespace and filter out empty IDs
        assetIds = assetIds.map((id) => id.trim()).filter((id) => !!id)

        // get unique asset IDs
        assetIds = Array.from(new Set(assetIds))

        productVariant.assetIds = assetIds
        productVariant.featuredAssetId = assetIds[0] // Use the first asset as the featured asset
    }

    const customFieldsArray = customFieldMappers?.map((mapper) => mapper(row)) || []
    if (customFieldsArray.length > 0) {
        productVariant.customFields = Object.assign({}, ...customFieldsArray)
    }

    const customFieldTranslationsArray = mergeTranslatedCustomFields(customFieldTranslationMappers?.map((mapper) => mapper(row)) || [])
    if (customFieldTranslationsArray.length > 0) {
        productVariant.translations = addCustomFieldsToTranslations(productVariant.translations ?? [], customFieldTranslationsArray)
    }

    return productVariant
}

/**
 * Maps a CSV row to an UpdateProductVariantInput object.
 * @param id The ID of the product variant to update.
 * @param row The CSV row to map.
 * @param customFieldMappers Optional array of custom field mappers.
 * @param customFieldTranslationMappers Optional array of custom field translation mappers.
 * @returns The mapped UpdateProductVariantInput object, or null if the row is invalid.
 */
export const updateProductVariantMapper: CustomUpdateProductVariantMapper = (id: string, row: ProductVariantCsvRow, customFieldMappers?: CustomFieldMappers, customFieldTranslationMappers?: CustomFieldMappers): UpdateProductVariantInput | null => {
    const productVariant: UpdateProductVariantInput = { id, translations: buildProductVariantTranslations(row) }

    if (row["sku"]) {
        productVariant.sku = row["sku"]
    }
    if (row["price"]) {
        productVariant.price = parseFloat(row["price"])
    }
    if (row["taxCategory:id"]) {
        productVariant.taxCategoryId = row["taxCategory:id"]
    }
    if (row["trackInventory"]) {
        productVariant.trackInventory = row["trackInventory"].toLocaleLowerCase() === "true" ? GlobalFlag.TRUE : GlobalFlag.FALSE
    }
    if (row["enabled"]) {
        productVariant.enabled = row["enabled"].toLocaleLowerCase() === "true"
    }
    if (row["outOfStockThreshold"]) {
        productVariant.outOfStockThreshold = parseInt(row["outOfStockThreshold"])
    }
    if (row["stockOnHand"]) {
        productVariant.stockOnHand = parseInt(row["stockOnHand"])
    }
    if (row["useGlobalOutOfStockThreshold"]) {
        productVariant.useGlobalOutOfStockThreshold = row["useGlobalOutOfStockThreshold"].toLocaleLowerCase() === "true"
    }
    if (row["option:ids"]) {
        const optionIds = row["option:ids"]
            .split(";")
            .map((option) => parseInt(option.trim()))
            .filter((id) => !!id)
        productVariant.optionIds = optionIds
    }
    if (row["facetValue:ids"]) {
        const facetValueIds = row["facetValue:ids"]
            .split(";")
            .map((id) => parseInt(id.trim()))
            .filter((id) => !!id)
        productVariant.facetValueIds = facetValueIds
    }

    const customFieldsArray = customFieldMappers?.map((mapper) => mapper(row)) || []
    if (customFieldsArray.length > 0) {
        productVariant.customFields = Object.assign({}, ...customFieldsArray)
    }

    const customFieldTranslationsArray = mergeTranslatedCustomFields(customFieldTranslationMappers?.map((mapper) => mapper(row)) || [])
    if (customFieldTranslationsArray.length > 0) {
        productVariant.translations = addCustomFieldsToTranslations(productVariant.translations ?? [], customFieldTranslationsArray)
    }

    return productVariant
}
