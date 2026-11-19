import { ID, PaginatedList, ProductOption, ProductOptionService, Translated, VendureConfig, idsAreEqual } from '@vendure/core';
import { BaseImporterService, BaseImporterServiceOptions } from './base-importer.service';
import { createProductOptionMapper, updateProductOptionMapper, ProductOptionCsvRow } from '../mapper';
import { CustomCreateProductOptionMapper, CustomFieldMappers, CustomUpdateProductOptionMapper } from '../types';

export interface ProductOptionImporterServiceOptions extends BaseImporterServiceOptions {
    codeField?: string;
    groupIdField?: string;
    customSlugFields?: string[];

    customCreateMapper?: CustomCreateProductOptionMapper;
    customUpdateMapper?: CustomUpdateProductOptionMapper;
    customFieldMappers?: CustomFieldMappers;
    customFieldTranslationMappers?: CustomFieldMappers;
}

export class ProductOptionImporterService extends BaseImporterService {
    private productOptionService: ProductOptionService;

    private codeField: string | undefined;
    private groupIdField: string | undefined;
    private customSlugFields: string[] | undefined;

    private customCreateMapper?: CustomCreateProductOptionMapper;
    private customUpdateMapper?: CustomUpdateProductOptionMapper;
    private customFieldMappers: CustomFieldMappers = [];
    private customFieldTranslationMappers: CustomFieldMappers = [];

    constructor(private options?: ProductOptionImporterServiceOptions) {
        super(options);

        this.codeField = this.options?.codeField ?? `code`;
        this.groupIdField = this.options?.groupIdField ?? `optionGroup:id`;

        this.customCreateMapper = options?.customCreateMapper;
        this.customUpdateMapper = options?.customUpdateMapper;
        this.customFieldMappers = options?.customFieldMappers || [];
        this.customFieldTranslationMappers = options?.customFieldTranslationMappers || [];
    }

    /**
     * Creates and initializes a new ProductOptionImporterService instance.
     */
    public static async create(
        config: VendureConfig,
        options?: ProductOptionImporterServiceOptions,
    ): Promise<ProductOptionImporterService> {
        const service = new ProductOptionImporterService(options);
        await service.initialize(config);
        return service;
    }

    /**
     * Imports product options from an array of CSV row data.
     * For each row, attempts to find an existing product option by code and groupId.
     * If found, updates the product option; otherwise, creates a new product option.
     * Tracks and logs statistics for processed, created, and updated product options.
     *
     * @param csvData - Array of parsed CSV rows representing product options data.
     * @returns {Promise<void>}
     * @throws If CSV data is missing or if an unexpected error stops the import.
     */
    public async importProductOptions(csvData: Array<ProductOptionCsvRow>) {
        this.ensureInitialized();

        if (!csvData) {
            throw new Error('CSV data is required for product options import.');
        }

        this.resetCounters();

        try {
            this.productOptionService = this.app.get(ProductOptionService);

            for (const row of csvData) {
                this.incrementProcessedCount();

                const fetchResult: PaginatedList<Translated<ProductOption>> | undefined =
                    await this.productOptionService.findAll(this.ctx);

                // the group id is a string when it comes from the CSV and a number when addProductOptionGroupIds
                // filled it in, so a strict comparison would miss the existing option in one of both cases
                const productOption = fetchResult?.items?.filter(
                    (option) =>
                        option.code === row[this.codeField as keyof ProductOptionCsvRow] &&
                        idsAreEqual(option.groupId, row[this.groupIdField as keyof ProductOptionCsvRow] as ID),
                );

                if (productOption && productOption.length > 0) {
                    await this.updateProductOption(productOption[0].id.toString(), row);
                } else {
                    await this.createProductOption(row);
                }
            }

            this.logStatistics();
        } catch (error) {
            this.abortImport('Product option', error);
        }
    }

    /**
     * Creates a new product option in Vendure.
     * @param row - The row from the CSV file containing product option data.
     * @returns {Promise<void>}
     */
    private async createProductOption(row: ProductOptionCsvRow): Promise<void> {
        const groupId: string = row[this.groupIdField as keyof ProductOptionCsvRow] as string;
        const code: string = row[this.codeField as keyof ProductOptionCsvRow] as string;
        if (!groupId) {
            this.rowError(code, `missing '${this.groupIdField}'`);
            return;
        }

        if (!code) {
            this.rowError(undefined, `missing '${this.codeField}'`);
            return;
        }

        const mapper: CustomCreateProductOptionMapper = this.customCreateMapper ?? createProductOptionMapper;
        const productOption = mapper(groupId, row, this.customFieldMappers, this.customFieldTranslationMappers);

        if (!productOption) {
            this.rowError(code, 'skipped, the mapper returned no data (required fields missing)');
            return;
        }

        if (!productOption.productOptionGroupId) {
            productOption.productOptionGroupId = groupId;
        }

        const result = await this.productOptionService.create(
            this.ctx,
            productOption.productOptionGroupId,
            productOption,
        );
        if (result) {
            this.incrementCreatedCount();
        } else {
            this.rowError(code, `option could not be created in group ${groupId}`);
        }
    }

    /**
     * Updates an existing product option in Vendure.
     * @param id - The ID of the product option to update.
     * @param row - The row from the CSV file containing product option data.
     * @returns {Promise<void>}
     */
    private async updateProductOption(id: string, row: ProductOptionCsvRow): Promise<void> {
        const code: string = row[this.codeField as keyof ProductOptionCsvRow] as string;
        if (!id) {
            this.rowError(code, `invalid option id '${id}'`);
            return;
        }

        if (!code) {
            this.rowError(undefined, `missing '${this.codeField}'`);
            return;
        }

        const mapper: CustomUpdateProductOptionMapper = this.customUpdateMapper ?? updateProductOptionMapper;
        const productOption = mapper(id, row, this.customFieldMappers, this.customFieldTranslationMappers);

        if (!productOption) {
            this.rowError(code, 'skipped, the mapper returned no data (required fields missing)');
            return;
        }

        if (!productOption?.id) {
            productOption.id = id; // Ensure the product option ID is set for update
        }

        const result = await this.productOptionService.update(this.ctx, productOption);
        if (result) {
            this.incrementUpdatedCount();
        } else {
            this.rowError(code, `option ${id} could not be updated`);
        }
    }

    /**
     * Adds product option IDs to the CSV data by looking up existing product options.
     * This method iterates through the provided CSV data, finds product options by their code and groupId,
     * and adds the product option ID(s) to each row under the specified idField.
     *
     * @param csvData - An array of CSV rows representing product option data.
     * @param groupIdField - The field name in the row that contains the product option group ID.
     * @param idField - The field name to add the found product option ID(s) to.
     * @param codeField - (Optional) The field name to use for looking up the product option code(s). Defaults to this.codeField.
     * @returns {Promise<Array<any>>} - Returns the updated CSV data with product option IDs added.
     * @throws Will throw an error if CSV data is not provided.
     */
    public async addProductOptionIds(
        csvData: Array<ProductOptionCsvRow>,
        groupIdField: string,
        idField: string,
        codeField?: string,
    ): Promise<Array<any>> {
        this.ensureInitialized();

        if (!csvData) {
            throw Error('CSV data is required for adding product option IDs.');
        }

        this.productOptionService = this.app.get(ProductOptionService);

        const fetchResult: PaginatedList<Translated<ProductOption>> | undefined = await this.productOptionService.findAll(
            this.ctx,
        );

        if (!fetchResult || fetchResult.items.length === 0) {
            console.warn('No product options found in Vendure. Returning original CSV data.');
            return csvData;
        }

        const updatedData = csvData.map((row) => {
            const newRow: any = { ...row };

            // Get the option codes from the row (can be multiple, separated by ;)
            const optionCodes = row[(codeField ?? this.codeField) as keyof ProductOptionCsvRow] as string;
            const optionCodesArray = optionCodes ? optionCodes.split(';').map((code) => code.trim()) : [];
            const groupId = row[groupIdField as keyof ProductOptionCsvRow] as string;

            // If no option codes are provided, skip this row
            if (!optionCodesArray || optionCodesArray.length === 0) {
                return newRow;
            }

            if (fetchResult && fetchResult.totalItems > 0) {
                const optionIdsArray = optionCodesArray.map((code) => {
                    const filteredResult = fetchResult.items.filter(
                        (option) => option.code === code && idsAreEqual(option.groupId, groupId),
                    );
                    return filteredResult.length > 0 ? filteredResult[0].id : null;
                });
                newRow[idField] = optionIdsArray.join(';');
            }

            return newRow;
        });

        return updatedData;
    }
}
