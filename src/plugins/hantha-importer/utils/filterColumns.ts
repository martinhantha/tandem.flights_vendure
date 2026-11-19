/**
 * Filters and transforms an array of objects by:
 *  - Keeping only properties that start with the given prefix (removing the prefix from the key)
 *  - Keeping properties listed in the `keep` array as-is
 *  - Keeping properties whose keys start with any value in `keep` followed by a colon (e.g., "product:name:" if "product:name" is in `keep`)
 *
 * @param items - Array of objects to filter
 * @param prefix - Prefix to match and remove from property names
 * @param keep - Array of property names to keep as-is or as prefixes (with colon)
 * @returns Filtered and transformed array of objects
 */
export const filterColumns = <T extends Record<string, any>>(
    items: T[],
    prefix: string,
    keep: string[],
): Record<string, any>[] => {
    return items.map((item) => {
        const result: Record<string, any> = {};
        for (const key in item) {
            // Keep properties that start with the prefix, removing the prefix from the key
            if (key.startsWith(prefix)) {
                result[key.slice(prefix.length)] = item[key];
            }
            // Keep properties that exactly match any value in the keep array
            if (keep.includes(key)) {
                result[key] = item[key];
            }
            // Keep properties whose key starts with any keep value followed by a colon
            if (keep.map((k) => `${k}:`).some((k) => key.startsWith(k))) {
                result[key] = item[key];
            }
        }
        return result;
    });
};
