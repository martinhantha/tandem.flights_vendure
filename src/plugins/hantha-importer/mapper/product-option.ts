import { CreateProductOptionInput, LanguageCode, UpdateProductOptionInput } from "@vendure/common/lib/generated-types"
import { CustomCreateProductOptionMapper, CustomFieldMappers, CustomUpdateProductOptionMapper } from "../types"
import { addCustomFieldsToTranslations, buildTranslations, mergeTranslatedCustomFields } from "../utils"

export interface ProductOptionCsvRow {
    code: string
    [key: `name:${string}`]: string
}

/**
 * Builds translations for all language codes present in the row for product option fields.
 * @param row The CSV row to build translations from.
 * @returns An array of translation objects for each language code found in the row.
 */
const buildProductOptionTranslations = (row: any): Array<any> => {
    return buildTranslations(row, ["name"], (row, lang) => ({
        languageCode: lang as LanguageCode,
        name: row[`name:${lang}`]?.trim() || "",
    }))
}

/**
 * Maps a CSV row to a CreateProductOptionInput object.
 * @param groupId The ID of the product option group to which this option belongs.
 * @param row The CSV row to map.
 * @param customFieldMappers Optional array of custom field mappers.
 * @param customFieldTranslationMappers Optional array of custom field translation mappers.
 * @returns The mapped CreateProductOptionInput object, or null if the row is invalid.
 */
export const createProductOptionMapper: CustomCreateProductOptionMapper = (groupId: string, row: ProductOptionCsvRow, customFieldMappers?: CustomFieldMappers, customFieldTranslationMappers?: CustomFieldMappers): CreateProductOptionInput | null => {
    const productOption: CreateProductOptionInput = {
        productOptionGroupId: groupId,
        code: row["code"],
        translations: buildProductOptionTranslations(row),
    }

    const customFieldsArray = customFieldMappers?.map((mapper) => mapper(row)) || []
    if (customFieldsArray.length > 0) {
        productOption.customFields = Object.assign({}, ...customFieldsArray)
    }

    const customFieldTranslationsArray = mergeTranslatedCustomFields(customFieldTranslationMappers?.map((mapper) => mapper(row)) || [])
    if (customFieldTranslationsArray.length > 0) {
        productOption.translations = addCustomFieldsToTranslations(productOption.translations ?? [], customFieldTranslationsArray)
    }

    return productOption
}

/**
 * Maps a CSV row to an UpdateProductOptionInput object.
 * @param id The ID of the product option to update.
 * @param row The CSV row to map.
 * @param customFieldMappers Optional array of custom field mappers.
 * @param customFieldTranslationMappers Optional array of custom field translation mappers.
 * @returns The mapped UpdateProductOptionInput object, or null if the row is invalid.
 */
export const updateProductOptionMapper: CustomUpdateProductOptionMapper = (id: string, row: ProductOptionCsvRow, customFieldMappers?: CustomFieldMappers, customFieldTranslationMappers?: CustomFieldMappers): UpdateProductOptionInput | null => {
    const productOption: UpdateProductOptionInput = { id, translations: buildProductOptionTranslations(row) }

    const customFieldsArray = customFieldMappers?.map((mapper) => mapper(row)) || []
    if (customFieldsArray.length > 0) {
        productOption.customFields = Object.assign({}, ...customFieldsArray)
    }

    const customFieldTranslationsArray = mergeTranslatedCustomFields(customFieldTranslationMappers?.map((mapper) => mapper(row)) || [])
    if (customFieldTranslationsArray.length > 0) {
        productOption.translations = addCustomFieldsToTranslations(productOption.translations ?? [], customFieldTranslationsArray)
    }

    return productOption
}
