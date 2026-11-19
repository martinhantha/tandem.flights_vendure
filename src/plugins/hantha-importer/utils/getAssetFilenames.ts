/**
 * Extracts all unique asset filenames from a list of objects.
 *
 * Each object should have a property (specified by `fieldName`) containing
 * filenames separated by semicolons (`;`) or pipes (`|`). This function
 * normalizes separators, splits the filenames, trims whitespace, removes
 * empty entries, and returns a deduplicated array of filenames.
 *
 * @param items - Array of objects, each containing an asset field.
 * @param fieldName - The property name in each object that holds the asset filenames.
 * @returns Array of unique, trimmed asset filenames.
 */
export function getAssetFilenames(items: Array<any>, fieldName: string): string[] {
    // Replace '|' with ';' in the specified field and return an array of asset filenames
    const onlyAssets = items?.map((item) => item?.[fieldName]?.replace(/\|/g, ';'));

    // Split the semicolon-separated filenames into an array
    const splittedAssets = onlyAssets?.flatMap((item) => item?.split(';'));

    // Trim whitespace and filter out empty strings
    const clearedAssets = splittedAssets?.map((item) => item?.trim())?.filter((item) => item?.length > 0);

    // Return unique asset filenames
    const uniqueAssets = Array.from(new Set(clearedAssets));

    return uniqueAssets;
}
