import { CreateAssetInput, UpdateAssetInput } from "@vendure/common/lib/generated-types"
import { CustomCreateAssetMapper, CustomFieldMappers, CustomUpdateAssetMapper } from "../types"
import path from "path"

export interface AssetCsvRow {
    filename: string
}

/**
 * Maps a CSV row to a CreateAssetInput object.
 * @param assetRootPath The root path for the asset files.
 * @param row The CSV row to map.
 * @returns The mapped CreateAssetInput object or null if the row is invalid.
 */
export const createAssetMapper: CustomCreateAssetMapper = (assetRootPath: string, row: AssetCsvRow, customFieldMappers?: CustomFieldMappers): CreateAssetInput | null => {
    const asset: CreateAssetInput = {
        file: new File([], path.join(assetRootPath, row.filename)),
    }

    const customFieldsArray = customFieldMappers?.map((mapper) => mapper(row)) || []
    if (customFieldsArray.length > 0) {
        asset.customFields = Object.assign({}, ...customFieldsArray)
    }

    return asset
}

/**
 * Maps a CSV row to an UpdateAssetInput object.
 * @param id The ID of the asset to update.
 * @param assetRootPath The root path for the asset files.
 * @param row The CSV row to map.
 * @returns The mapped UpdateAssetInput object or null if the row is invalid.
 */
export const updateAssetMapper: CustomUpdateAssetMapper = (id: string, row: AssetCsvRow, customFieldMappers?: CustomFieldMappers): UpdateAssetInput | null => {
    const asset: UpdateAssetInput = {
        id,
    }

    const customFieldsArray = customFieldMappers?.map((mapper) => mapper(row)) || []
    if (customFieldsArray.length > 0) {
        asset.customFields = Object.assign({}, ...customFieldsArray)
    }

    return asset
}
