import { ConfigurableOperationInput, CreateCollectionInput, UpdateCollectionInput, LanguageCode } from "@vendure/common/lib/generated-types"
import { CustomCreateCollectionMapper, CustomFieldMappers, CustomUpdateCollectionMapper } from "../types"
import { addCustomFieldsToTranslations, buildTranslations, mergeTranslatedCustomFields } from "../utils"

export interface CollectionCsvRow {
    isPrivate?: string
    filters?: string
    inheritFilters?: string
    [key: `name:${string}`]: string
    [key: `slug:${string}`]: string
    [key: `description:${string}`]: string | undefined
}

/**
 * Builds translations for all language codes present in the row for collection fields.
 * @param row The CSV row to build translations from.
 * @returns An array of translation objects for each language code found in the row.
 */
const buildCollectionTranslations = (row: any): Array<any> => {
    return buildTranslations(row, ["name", "slug", "description"], (row, lang) => ({
        languageCode: lang as LanguageCode,
        name: row[`name:${lang}`]?.trim() || "",
        slug: row[`slug:${lang}`]?.trim() || "",
        description: row[`description:${lang}`]?.trim() || "",
    }))
}

/**
 * Maps a CSV row to a CreateCollectionInput object.
 * @param row The CSV row to map.
 * @param customFieldMappers Optional array of custom field mappers.
 * @param customFieldTranslationMappers Optional array of custom field translation mappers.
 * @returns The mapped CreateCollectionInput object, or null if the row is invalid.
 */
export const createCollectionMapper: CustomCreateCollectionMapper = (row: CollectionCsvRow, customFieldMappers?: CustomFieldMappers, customFieldTranslationMappers?: CustomFieldMappers): CreateCollectionInput | null => {
    const collection: CreateCollectionInput = {
        filters: [] as Array<ConfigurableOperationInput>,
        translations: buildCollectionTranslations(row),
    }

    if (row["isPrivate"]) {
        collection.isPrivate = row["isPrivate"].toLowerCase() === "true"
    }
    if (row["inheritFilters"]) {
        collection.inheritFilters = row["inheritFilters"].toLowerCase() === "true"
    }
    if (row["filters"]) {
        try {
            collection.filters = JSON.parse(row["filters"])
        } catch (error) {
            console.warn(`Ignoring invalid 'filters' JSON, the collection is created without filters (${error}): ${row["filters"]}`)
        }
    }

    const customFieldsArray = customFieldMappers?.map((mapper) => mapper(row)) || []
    if (customFieldsArray.length > 0) {
        collection.customFields = Object.assign({}, ...customFieldsArray)
    }

    const customFieldTranslationsArray = mergeTranslatedCustomFields(customFieldTranslationMappers?.map((mapper) => mapper(row)) || [])
    if (customFieldTranslationsArray.length > 0) {
        collection.translations = addCustomFieldsToTranslations(collection.translations ?? [], customFieldTranslationsArray)
    }

    return collection
}

/**
 * Maps a CSV row to an UpdateCollectionInput object.
 * @param id The ID of the collection to update.
 * @param row The CSV row to map.
 * @param customFieldMappers Optional array of custom field mappers.
 * @param customFieldTranslationMappers Optional array of custom field translation mappers.
 * @returns The mapped UpdateCollectionInput object, or null if the row is invalid.
 */
export const updateCollectionMapper: CustomUpdateCollectionMapper = (id: string, row: CollectionCsvRow, customFieldMappers?: CustomFieldMappers, customFieldTranslationMappers?: CustomFieldMappers): UpdateCollectionInput | null => {
    const collection: UpdateCollectionInput = {
        id,
        translations: buildCollectionTranslations(row),
    }

    if (row["isPrivate"]) {
        collection.isPrivate = row["isPrivate"].toLowerCase() === "true"
    }
    if (row["inheritFilters"]) {
        collection.inheritFilters = row["inheritFilters"].toLowerCase() === "true"
    }
    if (row["filters"]) {
        try {
            collection.filters = JSON.parse(row["filters"])
        } catch (error) {
            console.warn(`Ignoring invalid 'filters' JSON, the collection keeps its current filters (${error}): ${row["filters"]}`)
        }
    }

    const customFieldsArray = customFieldMappers?.map((mapper) => mapper(row)) || []
    if (customFieldsArray.length > 0) {
        collection.customFields = Object.assign({}, ...customFieldsArray)
    }

    const customFieldTranslationsArray = mergeTranslatedCustomFields(customFieldTranslationMappers?.map((mapper) => mapper(row)) || [])
    if (customFieldTranslationsArray.length > 0) {
        collection.translations = addCustomFieldsToTranslations(collection.translations ?? [], customFieldTranslationsArray)
    }

    return collection
}
