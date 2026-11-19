import { CreateTaxCategoryInput, UpdateTaxCategoryInput } from "@vendure/common/lib/generated-types"
import { CustomCreateTaxCategoryMapper, CustomFieldMappers, CustomUpdateTaxCategoryMapper } from "../types"

export interface TaxCategoryCsvRow {
    name: string
    isDefault: string
}

/**
 * Maps a CSV row to a CreateTaxCategoryInput object.
 * @param row The CSV row to map.
 * @param customFieldMappers Optional array of custom field mappers.
 * @returns The mapped CreateTaxCategoryInput object, or null if the row is invalid.
 */
export const createTaxCategoryMapper: CustomCreateTaxCategoryMapper = (row: TaxCategoryCsvRow, customFieldMappers?: CustomFieldMappers): CreateTaxCategoryInput | null => {
    const taxCategory: CreateTaxCategoryInput = {
        name: row.name,
    }

    if (row.isDefault) {
        taxCategory.isDefault = row.isDefault.toLowerCase() === "true"
    }

    const customFieldsArray = customFieldMappers?.map((mapper) => mapper(row)) || []
    if (customFieldsArray.length > 0) {
        taxCategory.customFields = Object.assign({}, ...customFieldsArray)
    }

    return taxCategory
}

/**
 * Maps a CSV row to an UpdateTaxCategoryInput object.
 * @param id The ID of the tax category to update.
 * @param row The CSV row to map.
 * @param customFieldMappers Optional array of custom field mappers.
 * @returns The mapped UpdateTaxCategoryInput object, or null if the row is invalid.
 */
export const updateTaxCategoryMapper: CustomUpdateTaxCategoryMapper = (id: string, row: TaxCategoryCsvRow, customFieldMappers?: CustomFieldMappers): UpdateTaxCategoryInput | null => {
    const taxCategory: UpdateTaxCategoryInput = {
        id,
    }

    if (row.name) {
        taxCategory.name = row.name
    }
    if (row.isDefault) {
        taxCategory.isDefault = row.isDefault.toLowerCase() === "true"
    }

    const customFieldsArray = customFieldMappers?.map((mapper) => mapper(row)) || []
    if (customFieldsArray.length > 0) {
        taxCategory.customFields = Object.assign({}, ...customFieldsArray)
    }

    return taxCategory
}
