import { ProductVariantAttributeTranslationInput, CreateProductVariantAttributeInput, UpdateProductVariantAttributeInput } from "src/gql/generated"
import { LanguageCode } from "@vendure/core"
import { CustomCreateProductVariantAttributeMapper, CustomUpdateProductVariantAttributeMapper } from "../../types"
import { buildTranslations } from "../../../hantha-importer"

export interface ProductVariantAttributeCsvRow {
    "productVariant:id": string
    code: string
    [key: `value:${string}`]: string
}

/**
 * Builds translations for all language codes present in the row for product variant attribute fields.
 * @param row The CSV row to build translations from.
 * @returns An array of translation objects for each language code found in the row.
 */
const buildProductVariantAttributeTranslations = (row: any): Array<any> => {
    return buildTranslations(row, ["value"], (row, lang) => ({
        languageCode: lang as LanguageCode,
        value: row[`value:${lang}`]?.trim() || "",
    }))
}

/**
 * Maps a CSV row to a CreateProductVariantAttributeInput object.
 * @param row The CSV row to map.
 * @param attributePropertyId The resolved AttributeProperty ID for this row's `code`.
 * @returns The mapped CreateProductVariantAttributeInput object or null if the row is invalid.
 */
export const createProductVariantAttributeMapper: CustomCreateProductVariantAttributeMapper = (row: ProductVariantAttributeCsvRow, attributePropertyId: string): CreateProductVariantAttributeInput | null => {
    if (!row["productVariant:id"] || !row["code"] || !attributePropertyId) {
        return null
    }

    return {
        productVariantId: row["productVariant:id"],
        attributePropertyId,

        translations: buildProductVariantAttributeTranslations(row) as Array<ProductVariantAttributeTranslationInput>,
    }
}

/**
 * Maps a CSV row to an UpdateProductVariantAttributeInput object.
 * @param id The ID of the product variant attribute to update.
 * @param row The CSV row to map.
 * @param attributePropertyId The resolved AttributeProperty ID for this row's `code`.
 * @returns The mapped UpdateProductVariantAttributeInput object or null if the row is invalid.
 */
export const updateProductVariantAttributeMapper: CustomUpdateProductVariantAttributeMapper = (id: string, row: ProductVariantAttributeCsvRow, attributePropertyId: string): UpdateProductVariantAttributeInput | null => {
    if (!id || !row["productVariant:id"] || !row["code"] || !attributePropertyId) {
        return null
    }

    return {
        id,
        productVariantId: row["productVariant:id"],
        attributePropertyId,

        translations: buildProductVariantAttributeTranslations(row) as Array<ProductVariantAttributeTranslationInput>,
    }
}
