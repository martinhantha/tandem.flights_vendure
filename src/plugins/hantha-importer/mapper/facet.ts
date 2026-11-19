import { CreateFacetInput, UpdateFacetInput, LanguageCode } from "@vendure/common/lib/generated-types"
import { CustomCreateFacetMapper, CustomUpdateFacetMapper, CustomFieldMappers } from "../types"
import { addCustomFieldsToTranslations, buildTranslations, mergeTranslatedCustomFields } from "../utils"

export interface FacetCsvRow {
    "facet:isPrivate": string
    "facet:code": string
    "facetValues:code"?: string
    [key: `facet:name:${string}`]: string
    [key: `facetValues:name:${string}`]: string | undefined
}

/**
 * Builds translations for all language codes present in the row for facet fields.
 * @param row The CSV row to build translations from.
 * @returns An array of translation objects for each language code found in the row.
 */
const buildFacetTranslations = (row: any): Array<any> => {
    return buildTranslations(row, ["facet:name"], (row, lang) => ({
        languageCode: lang as LanguageCode,
        name: row[`facet:name:${lang}`]?.trim() || "",
    }))
}

/**
 * Maps a CSV row to a CreateFacetInput object.
 * @param row The CSV row to map.
 * @param customFieldMappers Optional array of custom field mappers.
 * @param customFieldTranslationMappers Optional array of custom field translation mappers.
 * @returns The mapped CreateFacetInput object, or null if the row is invalid.
 */
export const createFacetMapper: CustomCreateFacetMapper = (row: FacetCsvRow, customFieldMappers?: CustomFieldMappers, customFieldTranslationMappers?: CustomFieldMappers): CreateFacetInput | null => {
    const facet: CreateFacetInput = {
        code: row["facet:code"]?.trim() || "",
        isPrivate: row["facet:isPrivate"]?.toLowerCase() === "true",
        translations: buildFacetTranslations(row),
    }

    const customFieldsArray = customFieldMappers?.map((mapper) => mapper(row)) || []
    if (customFieldsArray.length > 0) {
        facet.customFields = Object.assign({}, ...customFieldsArray)
    }

    const customFieldTranslationsArray = mergeTranslatedCustomFields(customFieldTranslationMappers?.map((mapper) => mapper(row)) || [])
    if (customFieldTranslationsArray.length > 0) {
        facet.translations = addCustomFieldsToTranslations(facet.translations ?? [], customFieldTranslationsArray)
    }

    return facet
}

/**
 * Maps a CSV row to an UpdateFacetInput object.
 * @param id The ID of the facet to update.
 * @param row The CSV row to map.
 * @param customFieldMappers Optional array of custom field mappers.
 * @param customFieldTranslationMappers Optional array of custom field translation mappers.
 * @returns The mapped UpdateFacetInput object, or null if the row is invalid.
 */
export const updateFacetMapper: CustomUpdateFacetMapper = (id: string, row: FacetCsvRow, customFieldMappers?: CustomFieldMappers, customFieldTranslationMappers?: CustomFieldMappers): UpdateFacetInput | null => {
    const facet: UpdateFacetInput = {
        id,
        code: row["facet:code"]?.trim() || "",
        isPrivate: row["facet:isPrivate"]?.toLowerCase() === "true",
        translations: buildFacetTranslations(row),
    }

    const customFieldsArray = customFieldMappers?.map((mapper) => mapper(row)) || []
    if (customFieldsArray.length > 0) {
        facet.customFields = Object.assign({}, ...customFieldsArray)
    }

    const customFieldTranslationsArray = mergeTranslatedCustomFields(customFieldTranslationMappers?.map((mapper) => mapper(row)) || [])
    if (customFieldTranslationsArray.length > 0) {
        facet.translations = addCustomFieldsToTranslations(facet.translations ?? [], customFieldTranslationsArray)
    }

    return facet
}
