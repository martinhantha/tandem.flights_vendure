import { Collection, CollectionService, TransactionalConnection, Translated, VendureConfig, idsAreEqual } from '@vendure/core';
import { BaseImporterService, BaseImporterServiceOptions } from './base-importer.service';
import { CustomCreateCollectionMapper, CustomUpdateCollectionMapper, CustomFieldMappers } from '../types';
import { createCollectionMapper, updateCollectionMapper, CollectionCsvRow } from '../mapper';

export interface CollectionImporterServiceOptions extends BaseImporterServiceOptions {
    mainSlugField?: string;
    customSlugFields?: string[];

    customCreateMapper?: CustomCreateCollectionMapper;
    customUpdateMapper?: CustomUpdateCollectionMapper;
    customFieldMappers?: CustomFieldMappers;
    customFieldTranslationMappers?: CustomFieldMappers;
}

export class CollectionImporterService extends BaseImporterService {
    private collectionService: CollectionService;

    private mainSlugField: string | undefined;
    private customSlugFields: string[] = [];

    private customCreateMapper?: CustomCreateCollectionMapper;
    private customUpdateMapper?: CustomUpdateCollectionMapper;
    private customFieldMappers: CustomFieldMappers = [];
    private customFieldTranslationMappers: CustomFieldMappers = [];

    constructor(private options?: CollectionImporterServiceOptions) {
        super(options);

        this.mainSlugField = this.options?.mainSlugField;
        this.customSlugFields = this.options?.customSlugFields || [];

        this.customCreateMapper = options?.customCreateMapper;
        this.customUpdateMapper = options?.customUpdateMapper;
        this.customFieldMappers = options?.customFieldMappers || [];
        this.customFieldTranslationMappers = options?.customFieldTranslationMappers || [];
    }

    /**
     * Initializes the CollectionImporterService with Vendure configuration.
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
    }

    /**
     * Creates and initializes a new CollectionImporterService instance.
     */
    public static async create(
        config: VendureConfig,
        options?: CollectionImporterServiceOptions,
    ): Promise<CollectionImporterService> {
        const service = new CollectionImporterService(options);
        await service.initialize(config);
        return service;
    }

    /**
     * Imports collections from an array of CSV row data.
     * For each row, attempts to find an existing collection by slug in the current channel's default language.
     * If found, updates the collection; otherwise, creates a new collection.
     * Tracks and logs statistics for processed, created, and updated collections.
     *
     * @param csvData - Array of parsed CSV rows representing collection data.
     * @returns {Promise<void>}
     * @throws If CSV data is missing or if an unexpected error stops the import.
     */
    public async importCollections(csvData: Array<CollectionCsvRow>) {
        this.ensureInitialized();

        if (!csvData) {
            throw new Error('CSV data is required for collections import.');
        }

        this.resetCounters();

        try {
            this.collectionService = this.app.get(CollectionService);

            for (const row of csvData) {
                this.incrementProcessedCount();

                const slug = row[this.mainSlugField as keyof CollectionCsvRow] as string;
                const fetchResult: Translated<Collection> | undefined = await this.collectionService.findOneBySlug(
                    this.ctx,
                    slug,
                );

                if (fetchResult) {
                    await this.updateCollection(fetchResult.id.toString(), row);
                } else {
                    await this.createCollection(row);
                }
            }

            this.logStatistics();
        } catch (error) {
            this.abortImport('Collection', error);
        }
    }

    /**
     * Creates a new collection in Vendure.
     * @param row - The row from the CSV file containing collection data.
     * @returns {Promise<void>}
     */
    private async createCollection(row: CollectionCsvRow): Promise<void> {
        const slug: string = row[this.mainSlugField as keyof CollectionCsvRow] as string;
        if (!slug) {
            this.rowError(undefined, `missing '${this.mainSlugField}'`);
            return;
        }

        const mapper: CustomCreateCollectionMapper = this.customCreateMapper ?? createCollectionMapper;
        const collection = mapper(row, this.customFieldMappers, this.customFieldTranslationMappers);

        if (!collection) {
            this.rowError(slug, 'skipped, the mapper returned no data (required fields missing)');
            return;
        }

        const result = await this.collectionService.create(this.ctx, collection);
        if (result) {
            this.incrementCreatedCount();
        } else {
            this.rowError(slug, 'collection could not be created');
        }
    }

    /**
     * Updates an existing collection in Vendure.
     * @param id - The ID of the collection to update.
     * @param row - The row from the CSV file containing collection data.
     * @returns {Promise<void>}
     */
    private async updateCollection(id: string, row: CollectionCsvRow): Promise<void> {
        const slug: string = row[this.mainSlugField as keyof CollectionCsvRow] as string;
        if (!id) {
            this.rowError(slug, `invalid collection id '${id}'`);
            return;
        }

        if (!slug) {
            this.rowError(undefined, `missing '${this.mainSlugField}'`);
            return;
        }

        const mapper: CustomUpdateCollectionMapper = this.customUpdateMapper ?? updateCollectionMapper;
        const collection = mapper(id, row, this.customFieldMappers, this.customFieldTranslationMappers);

        if (!collection) {
            this.rowError(slug, 'skipped, the mapper returned no data (required fields missing)');
            return;
        }

        if (!collection?.id) {
            collection.id = id; // Ensure the collection ID is set for update
        }

        const result = await this.collectionService.update(this.ctx, collection);
        if (result) {
            this.incrementUpdatedCount();
        } else {
            this.rowError(slug, `collection ${id} could not be updated`);
        }
    }

    /**
     * Adds collection IDs to the CSV data by looking up existing collections.
     * This method iterates through the provided CSV data, finds collections by their slug in the current channel's default language,
     * and adds the collection ID to each row.
     * @param csvData - An array of CSV rows representing collection data.
     * @param idField - The field in the CSV data where the collection ID will be added.
     * @param slugField - Optional field in the CSV data containing the collection slug. Defaults to the main slug field.
     * @returns {Promise<Array<any>>} - Returns the updated CSV data with collection IDs added.
     * @throws Will throw an error if CSV data is not provided.
     */
    public async addCollectionIds(
        csvData: Array<CollectionCsvRow>,
        idField: string,
        slugField?: string,
    ): Promise<Array<any>> {
        this.ensureInitialized();

        if (!csvData) {
            throw Error('CSV data is required for adding collection IDs.');
        }

        this.collectionService = this.app.get(CollectionService);
        const updatedData = await Promise.all(
            csvData.map(async (row) => {
                const newRow: any = { ...row };

                const slug = row[(slugField ?? this.mainSlugField) as keyof CollectionCsvRow] as string;
                const fetchResult: Translated<Collection> | undefined = await this.collectionService.findOneBySlug(
                    this.ctx,
                    slug,
                );

                if (fetchResult) {
                    newRow[idField] = fetchResult.id;
                } else {
                    console.log(`No collection found for slug: ${slug}`);
                }

                return newRow;
            }),
        );

        return updatedData;
    }

    /**
     * Adds product variants to collections by updating the relation in the database.
     * For each row in the CSV data, associates the specified product variant with the specified collection.
     *
     * @param csvData - Array of objects, each containing at least a collection ID and a product variant ID.
     * @param collectionIdField - The key in each row that contains the collection ID.
     * @param productVariantIdField - The key in each row that contains the product variant ID.
     * @returns {Promise<void>}
     * @throws Will throw an error if CSV data is not provided or if a database error occurs.
     */
    public async addProductVariants(
        csvData: Array<any>,
        collectionIdField: string,
        productVariantIdField: string,
    ): Promise<void> {
        this.ensureInitialized();

        if (!csvData) {
            throw Error('CSV data is required for adding product variants to collections.');
        }

        const connection = this.app.get(TransactionalConnection);
        const collectionRepo = connection.getRepository(this.ctx, Collection);

        for (const [index, row] of csvData.entries()) {
            const productVariantId = row[productVariantIdField];
            const collectionId = row[collectionIdField];

            try {
                const collection = await collectionRepo.findOne({
                    where: { id: collectionId },
                    relations: ['productVariants'],
                });

                // ids from the CSV are strings, entity ids numbers - a strict comparison never matches, and adding
                // the relation a second time fails on the unique key
                if (collection?.productVariants?.some((pv) => idsAreEqual(pv.id, productVariantId))) {
                    continue;
                }

                // Add the product variant to the collection
                await collectionRepo
                    .createQueryBuilder()
                    .relation(Collection, 'productVariants')
                    .of(collectionId)
                    .add(productVariantId);
            } catch (error) {
                console.error(
                    `❌ Adding product variants to collections aborted at row ${index + 1} (collection ${collectionId}, variant ${productVariantId})`,
                );
                throw error;
            }
        }
    }
}
