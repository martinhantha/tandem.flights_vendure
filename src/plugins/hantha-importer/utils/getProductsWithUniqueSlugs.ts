import { LanguageCode } from '@vendure/core';
import { ProductCsvRow } from '../mapper';

export const getProductsWithUniqueSlugs = (
    slugField: string,
    languageCodes: Array<LanguageCode>,
    products: Array<ProductCsvRow>,
): Array<ProductCsvRow> => {
    const slugFields = languageCodes.map((lang) => `${slugField}:${lang}`);

    return products.map((product, _, arr) => {
        const newProduct = { ...product };
        slugFields.forEach((field) => {
            if (!arr.every((p) => field in p)) {
                throw new Error(`All products must have the following slug field: ${field}`);
            }
            const baseSlug = product[field as keyof ProductCsvRow] as string;
            let slug = baseSlug;
            let count = 1;
            // Check for duplicates in the already processed products
            while (arr.slice(0, _).some((p) => (p[field as keyof ProductCsvRow] as string) === slug)) {
                count++;
                slug = `${baseSlug}-${count}`;
            }
            newProduct[field as keyof ProductCsvRow] = slug;
        });
        return newProduct;
    });
};
