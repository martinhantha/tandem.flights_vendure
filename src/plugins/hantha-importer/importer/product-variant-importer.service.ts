import {
    ListQueryOptions,
    PaginatedList,
    ProductVariant,
    ProductVariantService,
    Translated,
    VendureConfig,
    idsAreEqual,
} from '@vendure/core';
import { BaseImporterService, BaseImporterServiceOptions } from './base-importer.service';
import { CustomCreateProductVariantMapper, CustomFieldMappers, CustomUpdateProductVariantMapper } from '../types';
import { createProductVariantMapper, ProductVariantCsvRow, updateProductVariantMapper } from '../mapper';

export interface ProductVariantImporterServiceOptions extends BaseImporterServiceOptions {
    skuField?: string;
    productIdField?: string;

    customCreateMapper?: CustomCreateProductVariantMapper;
    customUpdateMapper?: CustomUpdateProductVariantMapper;
    customFieldMappers?: CustomFieldMappers;
    customFieldTranslationMappers?: CustomFieldMappers;
}
export class ProductVariantImporterService extends BaseImporterService {
    private productVariantService: ProductVariantService;

    private skuField: string;
    private productIdField: string;

    private customCreateMapper?: CustomCreateProductVariantMapper;
    private customUpdateMapper?: CustomUpdateProductVariantMapper;
    private customFieldMappers: CustomFieldMappers = [];
    private customFieldTranslationMappers: CustomFieldMappers = [];

    constructor(private options?: ProductVariantImporterServiceOptions) {
        super(options);

        this.skuField = options?.skuField || 'sku';
        this.productIdField = options?.productIdField || 'product:id';

        this.customCreateMapper = options?.customCreateMapper;
        this.customUpdateMapper = options?.customUpdateMapper;
        this.customFieldMappers = options?.customFieldMappers ?? [];
        this.customFieldTranslationMappers = options?.customFieldTranslationMappers ?? [];
    }

    /**
     * Creates and initializes a new ProductVariantImporterService instance.
     */
    public static async create(
        config: VendureConfig,
        options?: ProductVariantImporterServiceOptions,
    ): Promise<ProductVariantImporterService> {
        const service = new ProductVariantImporterService(options);
        await service.initialize(config);
        return service;
    }

    /**
     * Imports product variants from an array of CSV row data.
     * For each row, attempts to find an existing product variant by SKU.
     * If found, updates the product variant; otherwise, creates a new product variant.
     * Tracks and logs statistics for processed, created, and updated product variants.
     *
     * @param csvData - Array of parsed CSV rows representing product variant data.
     * @returns {Promise<void>}
     * @throws If CSV data is missing or if an unexpected error stops the import.
     */
    public async importProductVariants(csvData: Array<ProductVariantCsvRow>) {
        this.ensureInitialized();

        if (!csvData) {
            throw new Error('CSV data is required for product variants import.');
        }

        this.resetCounters();

        try {
            this.productVariantService = this.app.get(ProductVariantService);

            for (const row of csvData) {
                this.incrementProcessedCount();

                const query: ListQueryOptions<ProductVariant> = {
                    filter: {
                        sku: {
                            eq: row[this.skuField as keyof ProductVariantCsvRow] as string,
                        },
                    },
                };

                const fetchResult: PaginatedList<Translated<ProductVariant>> | undefined =
                    await this.productVariantService.findAll(this.ctx, query);

                if (fetchResult?.items?.length > 0) {
                    const existing = fetchResult.items[0];
                    const csvProductId = row[this.productIdField as keyof ProductVariantCsvRow] as string;

                    // an update cannot move a variant to another product, so a different product in the CSV is
                    // worth pointing out - for every other row the lookup value is the same anyway
                    if (csvProductId && !idsAreEqual(existing.productId, csvProductId)) {
                        this.rowWarning(
                            existing.sku,
                            `variant belongs to product ${existing.productId}, the CSV says ${csvProductId} - only the variant itself is updated`,
                        );
                    }

                    await this.updateProductVariant(existing.id.toString(), row);
                } else {
                    await this.createProductVariant(row);
                }
            }

            this.logStatistics();
        } catch (error) {
            this.abortImport('Product variant', error);
        }
    }

    /**
     * Creates a new product variant in Vendure.
     * @param row - The row from the CSV file containing product variant data.
     * @returns {Promise<void>}
     */
    private async createProductVariant(row: ProductVariantCsvRow): Promise<void> {
        const productId: string = row[this.productIdField as keyof ProductVariantCsvRow] as string;
        const sku: string = row[this.skuField as keyof ProductVariantCsvRow] as string;
        if (!productId) {
            this.rowError(sku, `missing '${this.productIdField}'`);
            return;
        }

        if (!sku) {
            this.rowError(undefined, `missing '${this.skuField}'`);
            return;
        }

        const mapper: CustomCreateProductVariantMapper = this.customCreateMapper ?? createProductVariantMapper;
        const productVariant = mapper(productId, row, this.customFieldMappers, this.customFieldTranslationMappers);

        if (!productVariant) {
            this.rowError(sku, 'skipped, the mapper returned no data (required fields missing)');
            return;
        }

        const result = await this.productVariantService.create(this.ctx, [productVariant]);
        if (result) {
            this.incrementCreatedCount();
        } else {
            this.rowError(sku, `variant could not be created for product ${productId}`);
        }
    }

    /**
     * Updates an existing product variant in Vendure.
     * @param id - The ID of the product variant to update.
     * @param row - The row from the CSV file containing product variant data.
     * @returns {Promise<void>}
     */
    private async updateProductVariant(id: string, row: ProductVariantCsvRow): Promise<void> {
        const sku: string = row[this.skuField as keyof ProductVariantCsvRow] as string;
        if (!id) {
            this.rowError(sku, `invalid variant id '${id}'`);
            return;
        }

        if (!sku) {
            this.rowError(undefined, `missing '${this.skuField}'`);
            return;
        }

        const mapper: CustomUpdateProductVariantMapper = this.customUpdateMapper ?? updateProductVariantMapper;
        const productVariant = mapper(id, row, this.customFieldMappers, this.customFieldTranslationMappers);

        if (!productVariant) {
            this.rowError(sku, 'skipped, the mapper returned no data (required fields missing)');
            return;
        }

        if (!productVariant?.id) {
            productVariant.id = id; // Ensure the product variant ID is set for update
        }

        const result = await this.productVariantService.update(this.ctx, [productVariant]);
        if (result) {
            this.incrementUpdatedCount();
        } else {
            this.rowError(sku, `variant ${id} could not be updated`);
        }
    }

    /**
     * Adds product variant IDs to the CSV data by looking up existing product variants by SKU.
     * This method iterates through the provided CSV data, finds product variants by their SKU,
     * and adds the product variant ID to each row under the specified ID field.
     * If a SKU is not found, the ID field will not be set for that row.
     *
     * @param csvData - An array of CSV rows representing product variant data.
     * @param skuField - The field in the CSV data containing the product variant SKU.
     * @param idField - The field in the CSV data where the product variant ID will be added.
     * @returns {Promise<Array<any>>} - Returns the updated CSV data with product variant IDs added.
     * @throws Will throw an error if CSV data is not provided.
     */
    public async addProductVariantIds(
        csvData: Array<ProductVariantCsvRow>,
        skuField: string,
        idField: string,
    ): Promise<Array<any>> {
        this.ensureInitialized();

        if (!csvData) {
            throw Error('CSV data is required for adding product variant IDs.');
        }

        this.productVariantService = this.app.get(ProductVariantService);
        const updatedData = await Promise.all(
            csvData.map(async (row) => {
                const newRow: any = { ...row };

                const sku = row[(skuField || this.skuField) as keyof ProductVariantCsvRow] as string;

                const query: ListQueryOptions<ProductVariant> = {
                    filter: {
                        sku: {
                            eq: sku,
                        },
                    },
                };

                const fetchResult: PaginatedList<Translated<ProductVariant>> | undefined =
                    await this.productVariantService.findAll(this.ctx, query);

                if (fetchResult.items?.length > 0) {
                    newRow[idField] = fetchResult.items[0]?.id;
                } else {
                    console.log(`No product variant found for sku: ${sku}`);
                }

                return newRow;
            }),
        );

        return updatedData;
    }
}
