import { BaseImporterService, BaseImporterServiceOptions } from '../../../hantha-importer/importer/base-importer.service';
import { AttributePropertiesService } from '../../entities/attributeProperties/service';
import { CustomCreateAttributePropertyMapper, CustomUpdateAttributePropertyMapper } from '../../types';
import { AttributePropertyCsvRow, createAttributePropertyMapper, updateAttributePropertyMapper } from '../mapper';
import { VendureConfig } from '@vendure/core';

export interface AttributePropertiesImporterServiceOptions extends BaseImporterServiceOptions {
    codeField?: string;

    customCreateMapper?: CustomCreateAttributePropertyMapper;
    customUpdateMapper?: CustomUpdateAttributePropertyMapper;
}

export class AttributePropertiesImporterService extends BaseImporterService {
    private attributePropertiesService: AttributePropertiesService;

    private codeField: string;

    private customCreateMapper?: CustomCreateAttributePropertyMapper;
    private customUpdateMapper?: CustomUpdateAttributePropertyMapper;

    constructor(options?: AttributePropertiesImporterServiceOptions) {
        super(options);

        this.codeField = options?.codeField || 'code';

        this.customCreateMapper = options?.customCreateMapper;
        this.customUpdateMapper = options?.customUpdateMapper;
    }

    /**
     * Creates and initializes a new ImporterService instance.
     */
    public static async create(
        config: VendureConfig,
        options?: AttributePropertiesImporterServiceOptions,
    ): Promise<AttributePropertiesImporterService> {
        const service = new AttributePropertiesImporterService(options);
        await service.initialize(config);
        return service;
    }

    /**
     * Imports attribute properties from an array of CSV row objects.
     *
     * This method processes each row, determines if the attribute property already exists
     * (by code), and either updates the existing property or creates a new one. It uses
     * optional custom mappers if provided, and tracks statistics for processed, created,
     * and updated records. Row errors are logged to the console.
     *
     * @param csvData - Array of parsed CSV row objects representing attribute properties.
     * @returns Promise<void>
     * @throws If CSV data is missing or if an unexpected error stops the import.
     */
    public async importAttributeProperties(csvData: Array<AttributePropertyCsvRow>): Promise<void> {
        this.ensureInitialized();

        if (!csvData) {
            throw new Error('CSV data is required for attribute properties import.');
        }

        this.resetCounters();

        try {
            for (const row of csvData) {
                this.incrementProcessedCount();

                this.attributePropertiesService = this.app.get(AttributePropertiesService);
                const code: string = row[this.codeField as keyof AttributePropertyCsvRow] as string;
                const fetchResult = await this.attributePropertiesService.findOneByCode(this.ctx, code);

                if (fetchResult) {
                    await this.updateAttributeProperty(fetchResult.id.toString(), row);
                } else {
                    await this.createAttributeProperty(row);
                }
            }

            this.logStatistics();
        } catch (error) {
            this.abortImport('Attribute property', error);
        }
    }

    /**
     * Creates a new attribute property in Vendure.
     * @param row - The row from the CSV file containing attribute property data.
     * @returns {Promise<void>}
     */
    private async createAttributeProperty(row: AttributePropertyCsvRow): Promise<void> {
        const code: string = row[this.codeField as keyof AttributePropertyCsvRow] as string;
        if (!code) {
            this.rowError(undefined, `missing '${this.codeField}'`);
            return;
        }

        const mapper: CustomCreateAttributePropertyMapper = this.customCreateMapper ?? createAttributePropertyMapper;
        const attributeProperty = mapper(row);

        if (!attributeProperty) {
            this.rowError(code, "skipped, the mapper returned no data (the default mapper needs 'code' and 'type')");
            return;
        }

        const result = await this.attributePropertiesService.create(this.ctx, attributeProperty);
        if (result) {
            this.incrementCreatedCount();
        } else {
            this.rowError(code, 'attribute property could not be created');
        }
    }

    /**
     * Updates an existing attribute property in Vendure.
     * @param id - The ID of the attribute property to update.
     * @param row - The row from the CSV file containing attribute property data.
     * @returns {Promise<void>}
     */
    private async updateAttributeProperty(id: string, row: AttributePropertyCsvRow): Promise<void> {
        const code: string = row[this.codeField as keyof AttributePropertyCsvRow] as string;
        if (!id) {
            this.rowError(code, `invalid attribute property id '${id}'`);
            return;
        }

        if (!code) {
            this.rowError(undefined, `missing '${this.codeField}'`);
            return;
        }

        const mapper: CustomUpdateAttributePropertyMapper = this.customUpdateMapper ?? updateAttributePropertyMapper;
        const attributeProperty = mapper(id, row);

        if (!attributeProperty) {
            this.rowError(code, "skipped, the mapper returned no data (the default mapper needs 'code' and 'type')");
            return;
        }

        if (!attributeProperty.id) {
            attributeProperty.id = id; // Ensure the product ID is set for update
        }

        const result = await this.attributePropertiesService.update(this.ctx, attributeProperty);
        if (result) {
            this.incrementUpdatedCount();
        } else {
            this.rowError(code, `attribute property ${id} could not be updated`);
        }
    }
}