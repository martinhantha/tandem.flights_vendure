import { CreateProductOptionGroupInput, LanguageCode, UpdateProductOptionGroupInput } from "@vendure/common/lib/generated-types"
import { CustomCreateProductOptionGroupMapper, CustomFieldMappers, CustomUpdateProductOptionGroupMapper } from "../types"
import { addCustomFieldsToTranslations, buildTranslations, mergeTranslatedCustomFields } from "../utils"

export interface ProductOptionGroupCsvRow {
    code: string
    [key: `name:${string}`]: string
}

/**
 * Builds translations for all language codes present in the row for facet values.
 * @param row The CSV row to build translations from.
 * @returns An array of translations for each language code.
 */
const buildProductOptionGroupTranslations = (row: any): Array<any> => {
    return buildTranslations(row, ["name"], (row, lang) => ({
        languageCode: lang as LanguageCode,
        name: row[`name:${lang}`]?.trim() || "",
    }))
}

/**
 * Maps a CSV row to a CreateProductOptionGroupInput object.
 * @param row The CSV row to map.
 * @param customFieldMappers Optional array of custom field mappers.
 * @param customFieldTranslationMappers Optional array of custom field translation mappers.
 * @returns The mapped CreateProductOptionGroupInput object, or null if the row is invalid.
 */
export const createProductOptionGroupMapper: CustomCreateProductOptionGroupMapper = (row: ProductOptionGroupCsvRow, customFieldMappers?: CustomFieldMappers, customFieldTranslationMappers?: CustomFieldMappers): CreateProductOptionGroupInput | null => {
    const productOptionGroup: CreateProductOptionGroupInput = {
        code: row["code"],
        options: [],
        translations: buildProductOptionGroupTranslations(row),
    }

    const customFieldsArray = customFieldMappers?.map((mapper) => mapper(row)) || []
    if (customFieldsArray.length > 0) {
        productOptionGroup.customFields = Object.assign({}, ...customFieldsArray)
    }

    const customFieldTranslationsArray = mergeTranslatedCustomFields(customFieldTranslationMappers?.map((mapper) => mapper(row)) || [])
    if (customFieldTranslationsArray.length > 0) {
        productOptionGroup.translations = addCustomFieldsToTranslations(productOptionGroup.translations ?? [], customFieldTranslationsArray)
    }

    return productOptionGroup
}

/**
 * Maps a CSV row to an UpdateProductOptionGroupInput object.
 * @param id The ID of the product option group to update.
 * @param row The CSV row to map.
 * @param customFieldMappers Optional array of custom field mappers.
 * @param customFieldTranslationMappers Optional array of custom field translation mappers.
 * @returns The mapped UpdateProductOptionGroupInput object, or null if the row is invalid.
 */
export const updateProductOptionGroupMapper: CustomUpdateProductOptionGroupMapper = (id: string, row: ProductOptionGroupCsvRow, customFieldMappers?: CustomFieldMappers, customFieldTranslationMappers?: CustomFieldMappers): UpdateProductOptionGroupInput | null => {
    const productOptionGroup: UpdateProductOptionGroupInput = {
        id,
        translations: buildProductOptionGroupTranslations(row),
    }

    const customFieldsArray = customFieldMappers?.map((mapper) => mapper(row)) || []
    if (customFieldsArray.length > 0) {
        productOptionGroup.customFields = Object.assign({}, ...customFieldsArray)
    }

    const customFieldTranslationsArray = mergeTranslatedCustomFields(customFieldTranslationMappers?.map((mapper) => mapper(row)) || [])
    if (customFieldTranslationsArray.length > 0) {
        productOptionGroup.translations = addCustomFieldsToTranslations(productOptionGroup.translations ?? [], customFieldTranslationsArray)
    }

    return productOptionGroup
}
