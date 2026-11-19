import {
    ProductOptionGroup,
    ProductOptionGroupService,
    ProductService,
    Translated,
    VendureConfig,
} from '@vendure/core';
import { BaseImporterService, BaseImporterServiceOptions } from './base-importer.service';
import {
    CustomCreateProductOptionGroupMapper,
    CustomFieldMappers,
    CustomUpdateProductOptionGroupMapper,
} from '../types';
import { createProductOptionGroupMapper, ProductOptionGroupCsvRow, updateProductOptionGroupMapper } from '../mapper';

export interface ProductOptionGroupImporterServiceOptions extends BaseImporterServiceOptions {
    codeField?: string;
    productIdField?: string;

    customCreateMapper?: CustomCreateProductOptionGroupMapper;
    customUpdateMapper?: CustomUpdateProductOptionGroupMapper;
    customFieldMappers?: CustomFieldMappers;
    customFieldTranslationMappers?: CustomFieldMappers;
}

export class ProductOptionGroupImporterService extends BaseImporterService {
    private productOptionGroupService: ProductOptionGroupService;
    private productService: ProductService;

    private codeField: string;
    private productIdField: string;

    private customCreateMapper?: CustomCreateProductOptionGroupMapper;
    private customUpdateMapper?: CustomUpdateProductOptionGroupMapper;
    private customFieldMappers: CustomFieldMappers = [];
    private customFieldTranslationMappers: CustomFieldMappers = [];

    constructor(private options?: ProductOptionGroupImporterServiceOptions) {
        super(options);

        this.codeField = options?.codeField || 'code';
        this.productIdField = options?.productIdField || 'product:id';

        this.customCreateMapper = options?.customCreateMapper;
        this.customUpdateMapper = options?.customUpdateMapper;
        this.customFieldMappers = options?.customFieldMappers || [];
        this.customFieldTranslationMappers = options?.customFieldTranslationMappers || [];
    }

    /**
     * Creates and initializes a new ProductOptionGroupImporterService instance.
     */
    public static async create(
        config: VendureConfig,
        options?: ProductOptionGroupImporterServiceOptions,
    ): Promise<ProductOptionGroupImporterService> {
        const service = new ProductOptionGroupImporterService(options);
        await service.initialize(config);
        return service;
    }

    /**
     * Imports product option groups from an array of CSV row data.
     * For each row, attempts to find an existing product option group by code in the current channel's default language.
     * If found, updates the product option group; otherwise, creates a new product option group.
     * Tracks and logs statistics for processed, created, and updated product option groups.
     *
     * @param csvData - Array of parsed CSV rows representing product option group data.
     * @returns {Promise<void>}
     * @throws If CSV data is missing or if an unexpected error stops the import.
     */
    public async importProductOptionGroups(csvData: Array<ProductOptionGroupCsvRow>) {
        this.ensureInitialized();

        if (!csvData) {
            throw new Error('CSV data is required for product option group import.');
        }

        this.resetCounters();

        try {
            this.productOptionGroupService = this.app.get(ProductOptionGroupService);
            this.productService = this.app.get(ProductService);

            for (const row of csvData) {
                this.incrementProcessedCount();

                const code = row[this.codeField as keyof ProductOptionGroupCsvRow] as string;
                const productId = row[this.productIdField as keyof ProductOptionGroupCsvRow] as string;

                const optionGroups: Array<Translated<ProductOptionGroup>> =
                    await this.productOptionGroupService.getOptionGroupsByProductId(this.ctx, productId);

                const fetchResult: Array<Translated<ProductOptionGroup>> | undefined = optionGroups.filter(
                    (group) => group.code === code,
                );

                if (fetchResult && fetchResult.length > 0) {
                    await this.updateProductOptionGroup(fetchResult[0].id.toString(), row);
                } else {
                    await this.createProductOptionGroup(row);
                }
            }

            this.logStatistics();
        } catch (error) {
            this.abortImport('Product option group', error);
        }
    }

    /**
     * Creates a new product option group in Vendure.
     * @param row - The row from the CSV file containing product option group data.
     * @returns {Promise<void>}
     */
    private async createProductOptionGroup(row: ProductOptionGroupCsvRow): Promise<void> {
        const productId: string = row[this.productIdField as keyof ProductOptionGroupCsvRow] as string;
        const code: string = row[this.codeField as keyof ProductOptionGroupCsvRow] as string;
        if (!productId) {
            this.rowError(code, `missing '${this.productIdField}'`);
            return;
        }

        if (!code) {
            this.rowError(undefined, `missing '${this.codeField}'`);
            return;
        }

        const mapper: CustomCreateProductOptionGroupMapper = this.customCreateMapper ?? createProductOptionGroupMapper;
        const productOptionGroup = mapper(row, this.customFieldMappers, this.customFieldTranslationMappers);

        if (!productOptionGroup) {
            this.rowError(code, 'skipped, the mapper returned no data (required fields missing)');
            return;
        }

        const result = await this.productOptionGroupService.create(this.ctx, productOptionGroup);

        if (result) {
            const optionGroupId = result.id;

            const result2 = await this.productService.addOptionGroupToProduct(this.ctx, productId, optionGroupId);

            if (result2) {
                this.incrementCreatedCount();
            } else {
                this.rowError(code, `created as option group ${optionGroupId}, but it could not be added to product ${productId}`);
            }
        } else {
            this.rowError(code, 'option group could not be created');
        }
    }

    /**
     * Updates an existing product option group in Vendure.
     * @param id - The ID of the product option group to update.
     * @param row - The row from the CSV file containing product option group data.
     * @returns {Promise<void>}
     */
    private async updateProductOptionGroup(id: string, row: ProductOptionGroupCsvRow): Promise<void> {
        const code: string = row[this.codeField as keyof ProductOptionGroupCsvRow] as string;
        if (!id) {
            this.rowError(code, `invalid option group id '${id}'`);
            return;
        }

        if (!code) {
            this.rowError(undefined, `missing '${this.codeField}'`);
            return;
        }

        const mapper: CustomUpdateProductOptionGroupMapper = this.customUpdateMapper ?? updateProductOptionGroupMapper;
        const productOptionGroup = mapper(id, row, this.customFieldMappers, this.customFieldTranslationMappers);

        if (!productOptionGroup) {
            this.rowError(code, 'skipped, the mapper returned no data (required fields missing)');
            return;
        }

        if (!productOptionGroup?.id) {
            productOptionGroup.id = id; // Ensure the product option group ID is set for update
        }

        if (!productOptionGroup?.code) {
            productOptionGroup.code = code;
        }

        const result = await this.productOptionGroupService.update(this.ctx, productOptionGroup);
        if (result) {
            this.incrementUpdatedCount();
        } else {
            this.rowError(code, `option group ${id} could not be updated`);
        }
    }

    /**
     * Adds product option group IDs to the CSV data by looking up existing product option groups.
     * This method iterates through the provided CSV data, finds product option groups by their code in the current channel's default language,
     * and adds the product option group ID to each row under the specified idField.
     * @param csvData - An array of CSV rows representing product option group data.
     * @param idField - The field name to add the found product option group ID to.
     * @param codeField - (Optional) The field name to use for looking up the product option group code.
     * @param productIdField - (Optional) The field name to use for looking up the product ID.
     * @returns {Promise<Array<any>>} - Returns the updated CSV data with product option group IDs added.
     * @throws Will throw an error if CSV data is not provided.
     */
    public async addProductOptionGroupIds(
        csvData: Array<ProductOptionGroupCsvRow>,
        idField: string,
        codeField?: string,
        productIdField?: string,
    ): Promise<Array<any>> {
        this.ensureInitialized();

        if (!csvData) {
            throw Error('CSV data is required for adding product option group IDs.');
        }

        this.productOptionGroupService = this.app.get(ProductOptionGroupService);
        const updatedData = await Promise.all(
            csvData.map(async (row) => {
                const newRow: any = { ...row };

                const code = row[(codeField ?? this.codeField) as keyof ProductOptionGroupCsvRow] as string;
                const productId = row[
                    (productIdField ?? this.productIdField) as keyof ProductOptionGroupCsvRow
                ] as string;

                if (!code || !productId) return newRow; // Skip if no code or productId is provided

                const optionGroups: Array<Translated<ProductOptionGroup>> =
                    await this.productOptionGroupService.getOptionGroupsByProductId(this.ctx, productId);

                const fetchResult: Array<Translated<ProductOptionGroup>> | undefined = optionGroups.filter(
                    (group) => group.code === code,
                );

                if (fetchResult && fetchResult.length > 0) {
                    newRow[idField] = fetchResult[0].id;
                } else {
                    console.log(`No product option group found for code: ${code}`);
                }

                return newRow;
            }),
        );

        return updatedData;
    }
}
