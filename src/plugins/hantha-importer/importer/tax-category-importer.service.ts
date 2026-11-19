import { ListQueryOptions, PaginatedList, TaxCategory, TaxCategoryService, VendureConfig } from '@vendure/core';
import { BaseImporterService, BaseImporterServiceOptions } from './base-importer.service';
import { createTaxCategoryMapper, TaxCategoryCsvRow, updateTaxCategoryMapper } from '../mapper';
import { CustomCreateTaxCategoryMapper, CustomFieldMappers, CustomUpdateTaxCategoryMapper } from '../types';

export interface TaxCategoryImporterServiceOptions extends BaseImporterServiceOptions {
    mainNameField?: string;

    customCreateMapper?: CustomCreateTaxCategoryMapper;
    customUpdateMapper?: CustomUpdateTaxCategoryMapper;
    customFieldMappers?: CustomFieldMappers;
}

export class TaxCategoryImporterService extends BaseImporterService {
    private taxCategoryService: TaxCategoryService;

    private mainNameField: string;

    customCreateMapper?: CustomCreateTaxCategoryMapper;
    customUpdateMapper?: CustomUpdateTaxCategoryMapper;
    customFieldMappers: CustomFieldMappers;

    constructor(private options?: TaxCategoryImporterServiceOptions) {
        super(options);

        this.mainNameField = options?.mainNameField ?? '';

        this.customCreateMapper = options?.customCreateMapper;
        this.customUpdateMapper = options?.customUpdateMapper;
        this.customFieldMappers = options?.customFieldMappers || [];
    }

    /**
     * Initializes the TaxCategoryImporterService with Vendure configuration.
     * Sets the main name field based on the channel's default language code if not already set.
     *
     * @param config - The Vendure configuration object.
     * @returns {Promise<void>}
     */
    public async initialize(config: VendureConfig): Promise<void> {
        await super.initialize(config);

        if (!this.mainNameField) {
            this.mainNameField = `name:${this.channel?.defaultLanguageCode}`;
        }
    }

    /**
     * Creates and initializes a new TaxCategoryImporterService instance.
     */
    public static async create(
        config: VendureConfig,
        options?: TaxCategoryImporterServiceOptions,
    ): Promise<TaxCategoryImporterService> {
        const service = new TaxCategoryImporterService(options);
        await service.initialize(config);
        return service;
    }

    /**
     * Imports tax categories from an array of CSV row data.
     * For each row, attempts to find an existing tax category by name.
     * If found, updates the tax category; otherwise, creates a new tax category.
     * Tracks and logs statistics for processed, created, and updated tax categories.
     *
     * @param csvData - Array of parsed CSV rows representing tax category data.
     * @returns {Promise<void>}
     * @throws If CSV data is missing or if an unexpected error stops the import.
     */
    public async importTaxCategories(csvData: Array<TaxCategoryCsvRow>) {
        this.ensureInitialized();

        if (!csvData) {
            throw new Error('CSV data is required for tax categories import.');
        }

        this.resetCounters();

        try {
            this.taxCategoryService = this.app.get(TaxCategoryService);

            for (const row of csvData) {
                this.incrementProcessedCount();

                // Find by name field
                const query: ListQueryOptions<TaxCategory> = {
                    filter: {
                        name: {
                            eq: row[this.mainNameField as keyof TaxCategoryCsvRow] as string,
                        },
                    },
                };
                const fetchResult: PaginatedList<TaxCategory> = await this.taxCategoryService.findAll(this.ctx, query);

                if (fetchResult?.items?.length > 0) {
                    await this.updateTaxCategory(fetchResult.items[0].id.toString(), row);
                } else {
                    await this.createTaxCategory(row);
                }
            }

            this.logStatistics();
        } catch (error) {
            this.abortImport('Tax category', error);
        }
    }

    /**
     * Creates a new tax category in Vendure.
     * @param row - The row from the CSV file containing tax category data.
     * @returns {Promise<void>}
     */
    private async createTaxCategory(row: TaxCategoryCsvRow): Promise<void> {
        const name: string = row[this.mainNameField as keyof TaxCategoryCsvRow] as string;
        if (!name) {
            this.rowError(undefined, `missing '${this.mainNameField}'`);
            return;
        }

        const mapper: CustomCreateTaxCategoryMapper = this.customCreateMapper ?? createTaxCategoryMapper;
        const taxCategory = mapper(row, this.customFieldMappers);

        if (!taxCategory) {
            this.rowError(name, 'skipped, the mapper returned no data (required fields missing)');
            return;
        }

        const result = await this.taxCategoryService.create(this.ctx, taxCategory);

        if (result) {
            this.incrementCreatedCount();
        } else {
            this.rowError(name, 'tax category could not be created');
        }
    }

    /**
     * Updates an existing tax category in Vendure.
     * @param id - The ID of the tax category to update.
     * @param row - The row from the CSV file containing tax category data.
     * @returns {Promise<void>}
     */
    private async updateTaxCategory(id: string, row: TaxCategoryCsvRow): Promise<void> {
        const name: string = row[this.mainNameField as keyof TaxCategoryCsvRow] as string;
        if (!id) {
            this.rowError(name, `invalid tax category id '${id}'`);
            return;
        }

        if (!name) {
            this.rowError(undefined, `missing '${this.mainNameField}'`);
            return;
        }

        const mapper: CustomUpdateTaxCategoryMapper = this.customUpdateMapper ?? updateTaxCategoryMapper;
        const taxCategory = mapper(id, row, this.customFieldMappers);

        if (!taxCategory) {
            this.rowError(name, 'skipped, the mapper returned no data (required fields missing)');
            return;
        }

        if (!taxCategory?.id) {
            taxCategory.id = id; // Ensure the tax category ID is set for update
        }

        const result = await this.taxCategoryService.update(this.ctx, taxCategory);

        if (result) {
            this.incrementUpdatedCount();
        } else {
            this.rowError(name, `tax category ${id} could not be updated`);
        }
    }

    /**
     * Adds tax category IDs to the CSV data by looking up existing tax categories.
     * This method iterates through the provided CSV data, finds tax categories by their name,
     * and adds the tax category ID to each row.
     * @param csvData - An array of CSV rows representing tax category data.
     * @param idField - The field in the CSV data where the tax category ID will be added.
     * @param nameField - Optional field in the CSV data containing the tax category name. Defaults to the main name field.
     * @returns {Promise<Array<any>>} - Returns the updated CSV data with tax category IDs added.
     * @throws Will throw an error if CSV data is not provided.
     */
    public async addTaxCategoryIds(
        csvData: Array<TaxCategoryCsvRow>,
        idField: string,
        nameField?: string,
    ): Promise<Array<any>> {
        this.ensureInitialized();

        if (!csvData) {
            throw Error('CSV data is required for adding tax category IDs.');
        }

        this.taxCategoryService = this.app.get(TaxCategoryService);
        const taxCategories: PaginatedList<TaxCategory> = await this.taxCategoryService.findAll(this.ctx);

        const updatedData = csvData.map((row) => {
            const newRow: any = { ...row };

            const name = row[(nameField ?? this.mainNameField) as keyof TaxCategoryCsvRow] as string;
            const taxCategory = taxCategories.items.find((tc) => tc.name === name);

            if (taxCategory) {
                newRow[idField] = taxCategory.id;
            } else {
                console.log(`No tax category found for name: ${name}`);
            }

            return newRow;
        });

        return updatedData;
    }
}
