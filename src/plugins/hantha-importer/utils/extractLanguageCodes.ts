/**
 * Extracts all language codes present in the row for a given field prefix.
 * @param row The CSV row to extract from.
 * @param field The field prefix to look for (e.g., 'name', 'slug', 'description', etc.).
 * @returns An array of language codes found in the row.
 */
export const extractLanguageCodes = <T extends Record<string, any>>(row: T, field: string): Array<string> => {
    const prefix = `${field}:`;
    return Object.keys(row)
        .filter((key) => key.startsWith(prefix))
        .map((key) => key.slice(prefix.length));
};
