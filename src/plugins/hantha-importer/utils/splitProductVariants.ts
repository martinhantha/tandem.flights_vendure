/**
 * Splits product variants into separate rows for each combination of variant attributes,
 * but only splits columns where the number of '|' values matches.
 * @param rows Array of objects where each object represents a row with columns that may contain multiple values separated by '|'.
 * @returns Array of objects representing all combinations of variant attributes.
 */
export const splitProductVariants = <T extends Record<string, any>>(rows: T[]): T[] => {
    const expanded: T[] = [];
    for (const row of rows) {
        const columns = Object.keys(row);
        // Split each column by '|'
        const splitValues = columns.map((col) => String(row[col]).split('|'));
        // Find the maximum number of splits in any column
        const maxSplits = Math.max(...splitValues.map((arr) => arr.length));
        // If all columns have only one value, just push the row as-is
        if (maxSplits === 1) {
            expanded.push(row);
            continue;
        }
        // If some columns have multiple values, but not all, expand only those with matching counts
        for (let i = 0; i < maxSplits; i++) {
            const newRow: T = {} as T;
            columns.forEach((col, idx) => {
                // If this column has enough splits, use the i-th value, else use the first value
                const values = splitValues[idx];
                (newRow as Record<string, any>)[col] = values[i] !== undefined ? values[i] : values[0];
            });
            expanded.push(newRow);
        }
    }
    return expanded;
};
