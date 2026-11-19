/**
 * Merges arrays of translation objects by languageCode, combining their customFields.
 * @param arrays Array of arrays of translation objects
 * @returns Array with merged translation objects per languageCode
 */
export const mergeTranslatedCustomFields = (
    arrays: Array<Array<{ languageCode: string; customFields: Record<string, any> }>>,
): Array<{ languageCode: string; customFields: Record<string, any> }> => {
    const merged: Record<string, { languageCode: string; customFields: Record<string, any> }> = {};

    for (const arr of arrays) {
        for (const item of arr) {
            if (!merged[item.languageCode]) {
                merged[item.languageCode] = {
                    languageCode: item.languageCode,
                    customFields: { ...item.customFields },
                };
            } else {
                merged[item.languageCode].customFields = {
                    ...merged[item.languageCode].customFields,
                    ...item.customFields,
                };
            }
        }
    }

    return Object.values(merged);
};
