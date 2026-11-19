/**
 * Merges values from multiple fields into a single output field for each object in the array.
 * All source fields are strings with values separated by ';'.
 * Values from all source fields are combined, deduplicated, and stored in the output field.
 *
 * @param records Array of objects to process
 * @param sourceFields Array of field names whose values will be merged
 * @param outputField The name of the field to store the merged result
 * @returns The modified array with merged values in the output field
 */
export function mergeValues(records: Array<any>, sourceFields: Array<string>, outputField: string): Array<any> {
    return records.map((record) => {
        const values: Array<string> = [];

        sourceFields.forEach((sourceField) => {
            const sourceValues = record[sourceField]
                ?.split(';')
                ?.map((s: string) => s.trim())
                ?.filter(Boolean);

            if (!sourceValues) return;

            values.push(...sourceValues);
        });

        const mergedSet = new Set(values);
        return {
            ...record,
            [outputField]: Array.from(mergedSet).join(';'),
        };
    });
}
