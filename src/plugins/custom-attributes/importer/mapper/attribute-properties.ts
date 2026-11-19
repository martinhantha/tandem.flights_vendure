import { CreateAttributePropertyInput, AttributePropertyTranslationInput, UpdateAttributePropertyInput } from "src/gql/generated"
import { LanguageCode } from "@vendure/core"
import { CustomCreateAttributePropertyMapper, CustomUpdateAttributePropertyMapper } from "../../types"
import { buildTranslations } from "../../../hantha-importer"

export interface AttributePropertyCsvRow {
    code: string
    label?: string
    type: string
    sorting?: string
    translatable?: string
    comparable?: string
    searchable?: string
    filterable_in_list?: string
    filterable_in_search?: string
    visible_in_productdetail?: string
    [key: `name:${string}`]: string
    [key: `defaultValue:${string}`]: string
}

/**
 * Builds translations for all language codes present in the row for attribute property fields.
 * @param row The CSV row to build translations from.
 * @returns An array of translation objects for each language code found in the row.
 */
const buildAttributePropertiesTranslations = (row: any): Array<AttributePropertyTranslationInput> => {
    return buildTranslations(row, ["name", "defaultValue"], (row, lang) => ({
        languageCode: lang as LanguageCode,
        name: row[`name:${lang}`]?.trim() || "",
        defaultValue: row[`defaultValue:${lang}`]?.trim() || "",
    })) as Array<AttributePropertyTranslationInput>
}

/**
 * Returns the value of `key` from the first translation that has a non-empty value.
 * Used to populate the required top-level `name`/`defaultValue` fields on the input,
 * which mirror per-language translations.
 */
const pickFirstTranslated = (translations: Array<AttributePropertyTranslationInput>, key: "name" | "defaultValue"): string => {
    for (const t of translations) {
        const value = (t as any)[key]
        if (typeof value === "string" && value.length > 0) return value
    }
    return ""
}

/**
 * Maps a CSV row to a CreateAttributePropertyInput object.
 * @param row The CSV row to map.
 * @returns The mapped CreateAttributePropertyInput object, or null if required fields are missing.
 */
export const createAttributePropertyMapper: CustomCreateAttributePropertyMapper = (row: AttributePropertyCsvRow): CreateAttributePropertyInput | null => {
    if (!row.code || !row.type) {
        return null
    }

    const translations = buildAttributePropertiesTranslations(row)

    return {
        code: row.code,
        type: row.type,

        label: row?.label ?? "",
        sorting: row?.sorting ? parseInt(row.sorting, 10) : 0,
        translatable: row?.translatable?.toLocaleLowerCase() === "true",
        comparable: row?.comparable?.toLocaleLowerCase() === "true",
        searchable: row?.searchable?.toLocaleLowerCase() === "true",
        filterable_in_list: row?.filterable_in_list?.toLocaleLowerCase() === "true",
        filterable_in_search: row?.filterable_in_search?.toLocaleLowerCase() === "true",
        visible_in_productdetail: row?.visible_in_productdetail?.toLocaleLowerCase() === "true",

        name: pickFirstTranslated(translations, "name"),
        defaultValue: pickFirstTranslated(translations, "defaultValue"),

        translations,
    }
}

/**
 * Maps a CSV row to an UpdateAttributePropertyInput object.
 * @param id The ID of the attribute property to update.
 * @param row The CSV row to map.
 * @returns The mapped UpdateAttributePropertyInput object, or null if required fields are missing.
 */
export const updateAttributePropertyMapper: CustomUpdateAttributePropertyMapper = (id: string, row: AttributePropertyCsvRow): UpdateAttributePropertyInput | null => {
    if (!id || !row.code || !row.type) {
        return null
    }

    const translations = buildAttributePropertiesTranslations(row)

    return {
        id,

        code: row.code,
        type: row.type,

        label: row?.label ?? "",
        sorting: row?.sorting ? parseInt(row.sorting, 10) : 0,
        translatable: row?.translatable?.toLocaleLowerCase() === "true",
        comparable: row?.comparable?.toLocaleLowerCase() === "true",
        searchable: row?.searchable?.toLocaleLowerCase() === "true",
        filterable_in_list: row?.filterable_in_list?.toLocaleLowerCase() === "true",
        filterable_in_search: row?.filterable_in_search?.toLocaleLowerCase() === "true",
        visible_in_productdetail: row?.visible_in_productdetail?.toLocaleLowerCase() === "true",

        name: pickFirstTranslated(translations, "name"),
        defaultValue: pickFirstTranslated(translations, "defaultValue"),

        translations,
    }
}
