import { Product, ProductService, Translated, VendureConfig } from '@vendure/core';
import { BaseImporterService, BaseImporterServiceOptions } from './base-importer.service';
import { createProductMapper, updateProductMapper, ProductCsvRow } from '../mapper';
import { CustomCreateProductMapper, CustomFieldMappers, CustomUpdateProductMapper } from '../types';

export interface ProductImporterServiceOptions extends BaseImporterServiceOptions {
    mainSlugField?: string;
    optionGroupIdField?: string;

    customCreateMapper?: CustomCreateProductMapper;
    customUpdateMapper?: CustomUpdateProductMapper;
    customFieldMappers?: CustomFieldMappers;
    customFieldTranslationMappers?: CustomFieldMappers;
}

export class ProductImporterService extends BaseImporterService {
    private productService: ProductService;

    private mainSlugField: string | undefined;
    private optionGroupIdField: string | undefined;

    private customCreateMapper?: CustomCreateProductMapper;
    private customUpdateMapper?: CustomUpdateProductMapper;
    private customFieldMappers: CustomFieldMappers = [];
    private customFieldTranslationMappers: CustomFieldMappers = [];

    constructor(private options?: ProductImporterServiceOptions) {
        super(options);

        this.mainSlugField = this.options?.mainSlugField;
        this.optionGroupIdField = this.options?.optionGroupIdField;

        this.customCreateMapper = options?.customCreateMapper;
        this.customUpdateMapper = options?.customUpdateMapper;
        this.customFieldMappers = options?.customFieldMappers ?? [];
        this.customFieldTranslationMappers = options?.customFieldTranslationMappers ?? [];
    }

    /**
     * Initializes the ProductImporterService with Vendure configuration.
     * Sets the main slug field based on the channel's default language code if not already set.
     *
     * @param config - The Vendure configuration object.
     * @returns {Promise<void>}
     */
    public async initialize(config: VendureConfig): Promise<void> {
        await super.initialize(config);

        if (!this.mainSlugField) {
            this.mainSlugField = `slug:${this.channel?.defaultLanguageCode}`;
        }
        if (!this.optionGroupIdField) {
            this.optionGroupIdField = `optionGroup:id`;
        }
    }

    /**
     * Creates and initializes a new ProductImporterService instance.
     */
    public static async create(
        config: VendureConfig,
        options?: ProductImporterServiceOptions,
    ): Promise<ProductImporterService> {
        const service = new ProductImporterService(options);
        await service.initialize(config);
        return service;
    }

    /**
     * Imports products from an array of CSV row data.
     * For each row, attempts to find an existing product by slug in the current channel's default language.
     * If found, updates the product; otherwise, creates a new product.
     * Tracks and logs statistics for processed, created, and updated products.
     *
     * @param csvData - Array of parsed CSV rows representing product data.
     * @returns {Promise<void>}
     * @throws If CSV data is missing or if an unexpected error stops the import.
     */
    public async importProducts(csvData: Array<ProductCsvRow>) {
        this.ensureInitialized();

        if (!csvData) {
            throw new Error('CSV data is required for products import.');
        }

        this.resetCounters();

        try {
            this.productService = this.app.get(ProductService);

            for (const row of csvData) {
                this.incrementProcessedCount();

                const slug = row[this.mainSlugField as keyof ProductCsvRow] as string;
                const fetchResult: Translated<Product> | undefined = await this.productService.findOneBySlug(
                    this.ctx,
                    slug,
                );

                if (fetchResult) {
                    await this.updateProduct(fetchResult.id.toString(), row);
                } else {
                    await this.createProduct(row);
                }
            }

            this.logStatistics();
        } catch (error) {
            this.abortImport('Product', error);
        }
    }

    /**
     * Creates a new product in Vendure.
     * @param row - The row from the CSV file containing product data.
     * @returns {Promise<void>}
     */
    private async createProduct(row: ProductCsvRow): Promise<void> {
        const slug: string = row[this.mainSlugField as keyof ProductCsvRow] as string;
        if (!slug) {
            this.rowError(undefined, `missing '${this.mainSlugField}'`);
            return;
        }

        const mapper: CustomCreateProductMapper = this.customCreateMapper ?? createProductMapper;
        const product = mapper(row, this.customFieldMappers, this.customFieldTranslationMappers);

        if (!product) {
            this.rowError(slug, 'skipped, the mapper returned no data (required fields missing)');
            return;
        }

        const result = await this.productService.create(this.ctx, product);
        if (result) {
            const optionGroupIdField = this.optionGroupIdField;

            if (optionGroupIdField && row[optionGroupIdField as keyof ProductCsvRow]) {
                const optionGroupId = row[optionGroupIdField as keyof ProductCsvRow] as string;
                const result2 = await this.productService.addOptionGroupToProduct(this.ctx, result.id, optionGroupId);

                if (result2) {
                    this.incrementCreatedCount();
                } else {
                    this.rowError(slug, `created as product ${result.id}, but option group ${optionGroupId} could not be added`);
                }
            } else {
                this.incrementCreatedCount();
            }
        } else {
            this.rowError(slug, 'product could not be created');
        }
    }

    /**
     * Updates an existing product in Vendure.
     * @param row - The row from the CSV file containing product data.
     * @returns {Promise<void>}
     */
    private async updateProduct(id: string, row: ProductCsvRow): Promise<void> {
        const slug: string = row[this.mainSlugField as keyof ProductCsvRow] as string;
        if (!id) {
            this.rowError(slug, `invalid product id '${id}'`);
            return;
        }

        if (!slug) {
            this.rowError(undefined, `missing '${this.mainSlugField}'`);
            return;
        }

        const mapper: CustomUpdateProductMapper = this.customUpdateMapper ?? updateProductMapper;
        const product = mapper(id, row, this.customFieldMappers, this.customFieldTranslationMappers);

        if (!product) {
            this.rowError(slug, 'skipped, the mapper returned no data (required fields missing)');
            return;
        }

        if (!product?.id) {
            product.id = id; // Ensure the product ID is set for update
        }

        const result = await this.productService.update(this.ctx, product);

        if (result) {
            const optionGroupIdField = this.optionGroupIdField;

            if (optionGroupIdField && row[optionGroupIdField as keyof ProductCsvRow]) {
                const optionGroupId = row[optionGroupIdField as keyof ProductCsvRow] as string;
                const result2 = await this.productService.addOptionGroupToProduct(this.ctx, result.id, optionGroupId);

                if (result2) {
                    this.incrementUpdatedCount();
                } else {
                    this.rowError(slug, `product ${id} updated, but option group ${optionGroupId} could not be added`);
                }
            } else {
                this.incrementUpdatedCount();
            }
        } else {
            this.rowError(slug, `product ${id} could not be updated`);
        }
    }

    /**
     * Adds product IDs to the CSV data by looking up existing products.
     * This method iterates through the provided CSV data, finds products by their slug in the current channel's default language,
     * and adds the product ID to each row.
     * @param csvData - An array of CSV rows representing product data.
     * @param productIdField - The field in the CSV data where the product ID will be added.
     * @param slugField - Optional field in the CSV data containing the product slug. Defaults to the main slug field.
     * @returns {Promise<Array<any> | null>} - Returns the updated CSV data with product IDs added, or null if no data is provided.
     * @throws Will throw an error if CSV data is not provided.
     */
    public async addProductIds(
        csvData: Array<ProductCsvRow>,
        productIdField: string,
        slugField?: string,
    ): Promise<Array<any>> {
        this.ensureInitialized();

        if (!csvData) {
            throw Error('CSV data is required for adding product IDs.');
        }

        this.productService = this.app.get(ProductService);
        const updatedData = await Promise.all(
            csvData.map(async (row) => {
                const newRow: any = { ...row };

                const slug = row[(slugField ?? this.mainSlugField) as keyof ProductCsvRow] as string;
                const fetchResult: Translated<Product> | undefined = await this.productService.findOneBySlug(
                    this.ctx,
                    slug,
                );

                if (fetchResult) {
                    newRow[productIdField] = fetchResult.id;
                } else {
                    console.log(`No product found for slug: ${slug}`);
                }

                return newRow;
            }),
        );

        return updatedData;
    }
}
