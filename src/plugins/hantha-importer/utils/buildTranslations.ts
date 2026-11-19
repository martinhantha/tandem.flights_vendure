import { extractLanguageCodes } from './extractLanguageCodes';

type TranslationBuilder<T, R> = (row: T, lang: string) => R;

/**
 * Builds an array of translation objects for all language codes present in the given row.
 *
 * @template T - The type of the CSV row.
 * @template R - The type of the translation object to return.
 * @param row - The CSV row to extract translations from.
 * @param fields - The field prefixes to search for language codes (e.g., ['name', 'slug']).
 * @param builder - A function that constructs a translation object for a given language code.
 * @returns An array of translation objects, one for each detected language code.
 *
 * @example
 * ```typescript
 * const translations = buildTranslations(row, ['name', 'slug', 'description'], (row, lang) => ({
 *   languageCode: lang as LanguageCode,
 *   name: row[`name:${lang}`]?.trim() || '',
 *   slug: row[`slug:${lang}`]?.trim() || '',
 *   description: row[`description:${lang}`]?.trim() || '',
 * }));
 * ```
 */
export function buildTranslations<T extends Record<string, any>, R>(
    row: T,
    fields: string[],
    builder: TranslationBuilder<T, R>,
): R[] {
    const langSet = new Set<string>();
    fields.forEach((field) => {
        extractLanguageCodes(row, field).forEach((lang) => langSet.add(lang));
    });

    return Array.from(langSet).map((lang) => builder(row, lang));
}
