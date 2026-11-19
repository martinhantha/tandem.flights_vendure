/**
 * Builds an array of attribute objects from a flat input object, grouping values by attribute code and language.
 *
 * Intended for use with facet, product, or product variant row objects for the importer.
 *
 * @param input - The input object where keys are in the format 'attributeCode:lang' and values are the attribute values.
 * @param keep - An array of property names to keep and copy into each output object.
 * @returns An array of objects, each representing an attribute with values for different languages and kept properties.
 *
 * @example
 * ```typescript
 * const filteredAttributesCsvData = filterColumns(csvData, "productVariant:customAttributes:", ["productVariant:id"])
 *
 * const attributesCsvData: Array<any> = []
 * for (const row of filteredAttributesCsvData) {
 *     const variantAttributes = buildAttributeList(row, ["productVariant:id"])
 *     attributesCsvData.push(...variantAttributes)
 * }
 * ```
 */
export const buildAttributeList = (input: Record<string, any>, keep: string[] = []): Array<Record<string, any>> => {
    // Build a map of attribute codes to language values
    const attributeMap: Record<string, Record<string, any>> = {};

    for (const key of Object.keys(input)) {
        // Skip keys that should be kept as-is
        if (keep.includes(key)) continue;
        // Match keys of the form 'code:lang'
        const match = key.match(/^(.+):([a-z]{2,})$/i);
        if (!match) continue;
        const [, code, lang] = match;
        // Initialize the map for this attribute code if needed
        if (!attributeMap[code]) {
            attributeMap[code] = {};
        }
        // Store the value under the corresponding language
        attributeMap[code][lang] = input[key];
    }

    // Build the output array
    return Object.entries(attributeMap)
        .map(([code, values]) => {
            const obj: Record<string, any> = { code };
            // Add kept properties to each output object
            for (const keepKey of keep) {
                obj[keepKey] = input[keepKey];
            }
            // Add language-specific values, skipping empty strings
            let hasNonEmptyValue = false;
            for (const [lang, value] of Object.entries(values)) {
                if (value !== '') {
                    obj[`value:${lang}`] = value;
                    hasNonEmptyValue = true;
                }
            }
            // Only return the object if at least one value is non-empty
            return hasNonEmptyValue ? obj : undefined;
        })
        .filter((item): item is Record<string, any> => item !== undefined);
};
