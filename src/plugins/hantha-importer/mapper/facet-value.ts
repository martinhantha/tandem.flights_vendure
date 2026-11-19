import { LanguageCode, CreateFacetValueInput } from "@vendure/common/lib/generated-types"
import { CustomCreateFacetValuesMapper, CustomFieldMappers } from "../types"
import { FacetCsvRow } from "./facet"
import { addCustomFieldsToTranslations, buildTranslations, mergeTranslatedCustomFields, splitFacetValues } from "../utils"

/**
 * Builds translations for all language codes present in the row for facet value fields.
 * @param row The CSV row to build translations from.
 * @returns An array of translation objects for each language code found in the row.
 */
const buildFacetValueTranslations = (row: any): Array<any> => {
    return buildTranslations(row, ["facetValues:name"], (row, lang) => ({
        languageCode: lang as LanguageCode,
        name: row[`facetValues:name:${lang}`]?.trim() || "",
    }))
}

/**
 * Maps a CSV row to an array of CreateFacetValueInput objects.
 * @param facetId The ID of the facet to which the values belong.
 * @param row The CSV row to map.
 * @param customFieldMappers Optional array of custom field mappers.
 * @returns An array of CreateFacetValueInput objects, or null if the row is invalid. The importer reports the row.
 */
export const createFacetValuesMapper: CustomCreateFacetValuesMapper = (facetId: string, row: FacetCsvRow, customFieldMappers?: CustomFieldMappers, customFieldTranslationMappers?: CustomFieldMappers): Array<CreateFacetValueInput> | null => {
    if (!row["facetValues:code"] || !facetId) {
        return null
    }

    const facetValuesCsvData = splitFacetValues([row])
    const facetValues: Array<CreateFacetValueInput> = []

    facetValuesCsvData.forEach((facetValueRow) => {
        const facetValue: CreateFacetValueInput = {
            facetId,
            code: facetValueRow["facetValues:code"]?.trim() || "",
            translations: buildFacetValueTranslations(facetValueRow),
        }

        const customFieldsArray = customFieldMappers?.map((mapper) => mapper(row)) || []
        if (customFieldsArray.length > 0) {
            facetValue.customFields = Object.assign({}, ...customFieldsArray)
        }

        const customFieldTranslationsArray = mergeTranslatedCustomFields(customFieldTranslationMappers?.map((mapper) => mapper(row)) || [])
        if (customFieldTranslationsArray.length > 0) {
            facetValue.translations = addCustomFieldsToTranslations(facetValue.translations ?? [], customFieldTranslationsArray)
        }

        facetValues.push(facetValue)
    })

    return facetValues
}
