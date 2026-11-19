import { CreateProductInput, LanguageCode, UpdateProductInput } from "@vendure/common/lib/generated-types"
import { CustomCreateProductMapper, CustomFieldMappers, CustomUpdateProductMapper } from "../types"
import { addCustomFieldsToTranslations, buildTranslations, mergeTranslatedCustomFields } from "../utils"

export interface ProductCsvRow {
    enabled?: string
    "facetValue:ids"?: string
    "asset:ids"?: string
    [key: `name:${string}`]: string
    [key: `slug:${string}`]: string
    [key: `description:${string}`]: string | undefined
}

/**
 * Builds translations for all language codes present in the row for product fields.
 * @param row The CSV row to build translations from.
 * @returns An array of translation objects for each language code found in the row.
 */
const buildProductTranslations = (row: any): Array<any> => {
    return buildTranslations(row, ["name", "slug", "description"], (row, lang) => ({
        languageCode: lang as LanguageCode,
        name: row[`name:${lang}`]?.trim() || "",
        slug: row[`slug:${lang}`]?.trim() || "",
        description: row[`description:${lang}`]?.trim() || "",
    }))
}

/**
 * Maps a CSV row to a CreateProductInput object.
 * @param row The CSV row to map.
 * @param customFieldMappers Optional array of custom field mappers.
 * @param customFieldTranslationMappers Optional array of custom field translation mappers.
 * @returns The mapped CreateProductInput object, or null if the row is invalid.
 */
export const createProductMapper: CustomCreateProductMapper = (row: ProductCsvRow, customFieldMappers?: CustomFieldMappers, customFieldTranslationMappers?: CustomFieldMappers): CreateProductInput | null => {
    const product: CreateProductInput = {
        translations: buildProductTranslations(row),
    }

    if (row["enabled"]) {
        product.enabled = row["enabled"].toLowerCase() === "true"
    }
    if (row["facetValue:ids"]) {
        const facetValueIds = row["facetValue:ids"]
            .split(";")
            .map((id) => parseInt(id.trim()))
            .filter((id) => !!id)
        product.facetValueIds = facetValueIds
    }
    if (row["asset:ids"]) {
        let assetIds: string[] = []

        // remove groups (separated by '|') and split by ';' for individual asset IDs
        assetIds = row["asset:ids"].split("|").flatMap((group) => group.split(";"))

        // trim whitespace and filter out empty IDs
        assetIds = assetIds.map((id) => id.trim()).filter((id) => !!id)

        // get unique asset IDs
        assetIds = Array.from(new Set(assetIds))

        product.assetIds = assetIds
        product.featuredAssetId = assetIds[0] // Use the first asset as the featured asset
    }

    const customFieldsArray = customFieldMappers?.map((mapper) => mapper(row)) || []
    if (customFieldsArray.length > 0) {
        product.customFields = Object.assign({}, ...customFieldsArray)
    }

    const customFieldTranslationsArray = mergeTranslatedCustomFields(customFieldTranslationMappers?.map((mapper) => mapper(row)) || [])
    if (customFieldTranslationsArray.length > 0) {
        const newTranslations = addCustomFieldsToTranslations(product.translations ?? [], customFieldTranslationsArray)
        product.translations = newTranslations
    }

    return product
}

/**
 * Maps a CSV row to an UpdateProductInput object.
 * @param id The ID of the product to update.
 * @param row The CSV row to map.
 * @param customFieldMappers Optional array of custom field mappers.
 * @param customFieldTranslationMappers Optional array of custom field translation mappers.
 * @returns The mapped UpdateProductInput object, or null if the row is invalid.
 */
export const updateProductMapper: CustomUpdateProductMapper = (id: string, row: ProductCsvRow, customFieldMappers?: CustomFieldMappers, customFieldTranslationMappers?: CustomFieldMappers): UpdateProductInput | null => {
    const product: UpdateProductInput = {
        id,
        translations: buildProductTranslations(row),
    }

    if (row["enabled"]) {
        product.enabled = row["enabled"].toLowerCase() === "true"
    }
    if (row["facetValue:ids"]) {
        const facetValueIds = row["facetValue:ids"]
            .split(";")
            .map((id) => parseInt(id.trim()))
            .filter((id) => !!id)
        product.facetValueIds = facetValueIds
    }

    const customFieldsArray = customFieldMappers?.map((mapper) => mapper(row)) || []
    if (customFieldsArray.length > 0) {
        product.customFields = Object.assign({}, ...customFieldsArray)
    }

    const customFieldTranslationsArray = mergeTranslatedCustomFields(customFieldTranslationMappers?.map((mapper) => mapper(row)) || [])
    if (customFieldTranslationsArray.length > 0) {
        product.translations = addCustomFieldsToTranslations(product.translations ?? [], customFieldTranslationsArray)
    }

    return product
}
