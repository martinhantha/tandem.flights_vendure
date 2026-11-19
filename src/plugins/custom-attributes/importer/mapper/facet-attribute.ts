import { FacetAttributeTranslationInput, CreateFacetAttributeInput, UpdateFacetAttributeInput } from "src/gql/generated"
import { LanguageCode } from "@vendure/core"
import { CustomCreateFacetAttributeMapper, CustomUpdateFacetAttributeMapper } from "../../types"
import { buildTranslations } from "../../../hantha-importer"

export interface FacetAttributeCsvRow {
    "facet:id": string
    code: string
    [key: `value:${string}`]: string
}

/**
 * Builds translations for all language codes present in the row for facet attribute fields.
 * @param row The CSV row to build translations from.
 * @returns An array of translation objects for each language code found in the row.
 */
const buildFacetAttributeTranslations = (row: any): Array<any> => {
    return buildTranslations(row, ["value"], (row, lang) => ({
        languageCode: lang as LanguageCode,
        value: row[`value:${lang}`]?.trim() || "",
    }))
}

/**
 * Maps a CSV row to a CreateFacetAttributeInput object.
 * @param row The CSV row to map.
 * @param attributePropertyId The resolved AttributeProperty ID for this row's `code`.
 * @returns The mapped CreateFacetAttributeInput object or null if the row is invalid.
 */
export const createFacetAttributeMapper: CustomCreateFacetAttributeMapper = (row: FacetAttributeCsvRow, attributePropertyId: string): CreateFacetAttributeInput | null => {
    if (!row["facet:id"] || !row["code"] || !attributePropertyId) {
        return null
    }

    return {
        facetId: row["facet:id"],
        attributePropertyId,

        translations: buildFacetAttributeTranslations(row) as Array<FacetAttributeTranslationInput>,
    }
}

/**
 * Maps a CSV row to an UpdateFacetAttributeInput object.
 * @param id The ID of the facet attribute to update.
 * @param row The CSV row to map.
 * @param attributePropertyId The resolved AttributeProperty ID for this row's `code`.
 * @returns The mapped UpdateFacetAttributeInput object or null if the row is invalid.
 */
export const updateFacetAttributeMapper: CustomUpdateFacetAttributeMapper = (id: string, row: FacetAttributeCsvRow, attributePropertyId: string): UpdateFacetAttributeInput | null => {
    if (!id || !row["facet:id"] || !row["code"] || !attributePropertyId) {
        return null
    }

    return {
        id,
        facetId: row["facet:id"],
        attributePropertyId,

        translations: buildFacetAttributeTranslations(row) as Array<FacetAttributeTranslationInput>,
    }
}
