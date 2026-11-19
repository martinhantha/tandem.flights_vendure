import { ProductAttributeTranslationInput, CreateProductAttributeInput, UpdateProductAttributeInput } from "src/gql/generated"
import { LanguageCode } from "@vendure/core"
import { CustomCreateProductAttributeMapper, CustomUpdateProductAttributeMapper } from "../../types"
import { buildTranslations } from "../../../hantha-importer"

export interface ProductAttributeCsvRow {
    "product:id": string
    code: string
    useDefault?: string
    [key: `value:${string}`]: string
}

/**
 * Builds translations for all language codes present in the row for product attribute fields.
 * @param row The CSV row to build translations from.
 * @returns An array of translation objects for each language code found in the row.
 */
const buildProductAttributeTranslations = (row: any): Array<any> => {
    return buildTranslations(row, ["value"], (row, lang) => ({
        languageCode: lang as LanguageCode,
        value: row[`value:${lang}`]?.trim() || "",
    }))
}

/**
 * Maps a CSV row to a CreateProductAttributeInput object.
 * @param row The CSV row to map.
 * @param attributePropertyId The resolved AttributeProperty ID for this row's `code`.
 * @returns The mapped CreateProductAttributeInput object or null if the row is invalid.
 */
export const createProductAttributeMapper: CustomCreateProductAttributeMapper = (row: ProductAttributeCsvRow, attributePropertyId: string): CreateProductAttributeInput | null => {
    if (!row["product:id"] || !row["code"] || !attributePropertyId) {
        return null
    }

    return {
        productId: row["product:id"],
        attributePropertyId,
        useDefault: row?.useDefault?.toLocaleLowerCase() === "true",

        translations: buildProductAttributeTranslations(row) as Array<ProductAttributeTranslationInput>,
    }
}

/**
 * Maps a CSV row to an UpdateProductAttributeInput object.
 * @param id The ID of the product attribute to update.
 * @param row The CSV row to map.
 * @param attributePropertyId The resolved AttributeProperty ID for this row's `code`.
 * @returns The mapped UpdateProductAttributeInput object or null if the row is invalid.
 */
export const updateProductAttributeMapper: CustomUpdateProductAttributeMapper = (id: string, row: ProductAttributeCsvRow, attributePropertyId: string): UpdateProductAttributeInput | null => {
    if (!id || !row["product:id"] || !row["code"] || !attributePropertyId) {
        return null
    }

    return {
        id,
        productId: row["product:id"],
        attributePropertyId,
        useDefault: row?.useDefault?.toLocaleLowerCase() === "true",

        translations: buildProductAttributeTranslations(row) as Array<ProductAttributeTranslationInput>,
    }
}
