import { Facet, FacetService, FacetValue, FacetValueService, ListQueryOptions, Translated, VendureConfig } from "@vendure/core"
import { BaseImporterService, BaseImporterServiceOptions } from "./base-importer.service"
import { CustomCreateFacetMapper, CustomCreateFacetValuesMapper, CustomFieldMappers, CustomUpdateFacetMapper } from "../types"
import { createFacetMapper, FacetCsvRow, updateFacetMapper, createFacetValuesMapper } from "../mapper"
import { CreateFacetValueInput, UpdateFacetValueInput } from "@vendure/common/lib/generated-types"

export interface FacetImporterServiceOptions extends BaseImporterServiceOptions {
    facetCodeField?: string
    facetValueCodeField?: string

    customCreateFacetMapper?: CustomCreateFacetMapper
    customUpdateFacetMapper?: CustomUpdateFacetMapper
    facetCustomFieldMappers?: CustomFieldMappers
    facetCustomFieldTranslationMappers?: CustomFieldMappers

    customCreateFacetValuesMapper?: CustomCreateFacetValuesMapper
    facetValueCustomFieldMappers?: CustomFieldMappers
    facetValueCustomFieldTranslationMappers?: CustomFieldMappers
}

export class FacetImporterService extends BaseImporterService {
    private facetService: FacetService
    private facetValueService: FacetValueService

    private facetCodeField: string
    private facetValueCodeField: string

    private customCreateFacetMapper?: CustomCreateFacetMapper
    private customUpdateFacetMapper?: CustomUpdateFacetMapper
    private facetCustomFieldMappers: CustomFieldMappers = []
    private facetCustomFieldTranslationMappers: CustomFieldMappers = []

    private customCreateFacetValuesMapper?: CustomCreateFacetValuesMapper
    private facetValueCustomFieldMappers: CustomFieldMappers = []
    private facetValueCustomFieldTranslationMappers: CustomFieldMappers = []

    constructor(private options?: FacetImporterServiceOptions) {
        super(options)

        this.facetCodeField = options?.facetCodeField || "facet:code"
        this.facetValueCodeField = options?.facetValueCodeField || "facetValues:code"

        this.customCreateFacetMapper = options?.customCreateFacetMapper
        this.customUpdateFacetMapper = options?.customUpdateFacetMapper
        this.facetCustomFieldMappers = options?.facetCustomFieldMappers || []
        this.facetCustomFieldTranslationMappers = options?.facetCustomFieldTranslationMappers || []

        this.customCreateFacetValuesMapper = options?.customCreateFacetValuesMapper
        this.facetValueCustomFieldMappers = options?.facetValueCustomFieldMappers || []
        this.facetValueCustomFieldTranslationMappers = options?.facetValueCustomFieldTranslationMappers || []
    }

    /**
     * Creates and initializes a new FacetImporterService instance.
     */
    public static async create(config: VendureConfig, options?: FacetImporterServiceOptions): Promise<FacetImporterService> {
        const service = new FacetImporterService(options)
        await service.initialize(config)
        return service
    }

    /**
     * Imports facets from an array of CSV row data.
     * For each row, attempts to find an existing facet by code in the current channel's default language.
     * If found, updates the facet; otherwise, creates a new facet.
     * Tracks and logs statistics for processed, created, and updated facets.
     *
     * @param csvData - Array of parsed CSV rows representing facet data.
     * @returns {Promise<void>}
     * @throws If CSV data is missing or if an unexpected error stops the import.
     */
    public async importFacets(csvData: Array<FacetCsvRow>) {
        this.ensureInitialized()

        if (!csvData) {
            throw new Error("CSV data is required for facet import.")
        }

        this.resetCounters()

        try {
            this.facetService = this.app.get(FacetService)
            this.facetValueService = this.app.get(FacetValueService)

            for (const row of csvData) {
                this.incrementProcessedCount()

                const code: string = row[this.facetCodeField as keyof FacetCsvRow] as string
                const fetchResult: Translated<Facet> | undefined = await this.facetService.findByCode(this.ctx, code, this.channel.defaultLanguageCode)

                if (fetchResult) {
                    await this.updateFacet(fetchResult.id.toString(), row)
                } else {
                    await this.createFacet(row)
                }
            }

            this.logStatistics()
        } catch (error) {
            this.abortImport("Facet", error)
        }
    }

    /**
     * Creates a new facet in Vendure.
     * @param row - The row from the CSV file containing facet data.
     * @returns {Promise<void>}
     */
    private async createFacet(row: FacetCsvRow): Promise<void> {
        const code: string = row[this.facetCodeField as keyof FacetCsvRow] as string
        if (!code) {
            this.rowError(undefined, `missing '${this.facetCodeField}'`)
            return
        }

        const mapper: CustomCreateFacetMapper = this.customCreateFacetMapper ?? createFacetMapper
        const facet = mapper(row, this.facetCustomFieldMappers, this.facetCustomFieldTranslationMappers)

        if (!facet) {
            this.rowError(code, "skipped, the mapper returned no data (required fields missing)")
            return
        }

        const facetResult: Translated<Facet> = await this.facetService.create(this.ctx, facet)
        if (facetResult) {
            this.incrementCreatedCount()
            await this.importFacetValues(facetResult, row)
        } else {
            this.rowError(code, "facet could not be created")
        }
    }

    /**
     * Updates an existing facet in Vendure.
     * @param row - The row from the CSV file containing facet data.
     * @returns {Promise<void>}
     */
    private async updateFacet(id: string, row: FacetCsvRow): Promise<void> {
        const code: string = row[this.facetCodeField as keyof FacetCsvRow] as string
        if (!id) {
            this.rowError(code, `invalid facet id '${id}'`)
            return
        }

        if (!code) {
            this.rowError(undefined, `missing '${this.facetCodeField}'`)
            return
        }

        const mapper: CustomUpdateFacetMapper = this.customUpdateFacetMapper ?? updateFacetMapper
        const facet = mapper(id, row, this.facetCustomFieldMappers, this.facetCustomFieldTranslationMappers)

        if (!facet) {
            this.rowError(code, "skipped, the mapper returned no data (required fields missing)")
            return
        }

        if (!facet?.id) {
            facet.id = id // Ensure the facet ID is set for update
        }

        const result = await this.facetService.update(this.ctx, facet)
        if (result) {
            this.incrementUpdatedCount()
        } else {
            this.rowError(code, `facet ${id} could not be updated`)
        }
    }

    /**
     * Imports facet values for a given facet.
     * For each facet value in the row, checks if it exists for the facet.
     * If it exists, updates the facet value; otherwise, creates a new facet value.
     *
     * @param facet - The facet entity for which facet values are being imported.
     * @param row - The CSV row containing facet value data.
     * @returns {Promise<void>}
     */
    private async importFacetValues(facet: Translated<Facet>, row: FacetCsvRow) {
        const code: string = row[this.facetCodeField as keyof FacetCsvRow] as string
        const mapper: CustomCreateFacetValuesMapper = this.customCreateFacetValuesMapper ?? createFacetValuesMapper
        const facetValues: Array<CreateFacetValueInput> | null = mapper(facet.id.toString(), row, this.facetValueCustomFieldMappers, this.facetValueCustomFieldTranslationMappers)

        if (!facetValues) {
            this.rowError(code, `facet ${facet.id} created without values, the mapper returned no data ('facetValues:code' missing?)`)
            return
        }

        for (const facetValue of facetValues) {
            try {
                const facetValueCode: string = facetValue.code

                const query: ListQueryOptions<FacetValue> = {
                    filter: {
                        facetId: {
                            eq: facet.id.toString(),
                        },
                        code: {
                            eq: facetValueCode,
                        },
                    },
                }

                const queryResult = await this.facetValueService.findAllList(this.ctx, query)

                if (queryResult?.items?.length > 0) {
                    const facetValueForUpdate: UpdateFacetValueInput = {
                        id: queryResult.items[0].id,
                        ...facetValue,
                    }

                    await this.facetValueService.update(this.ctx, facetValueForUpdate)
                } else {
                    await this.facetValueService.create(this.ctx, facet, facetValue)
                }
            } catch (error) {
                this.rowError(code, `facet value '${facetValue.code}' could not be saved: ${(error as Error)?.message ?? error}`)
            }
        }
    }

    /**
     * Adds facet value IDs to the CSV data by looking up existing facet values.
     * This method iterates through the provided CSV data, finds facet values by their code,
     * and adds the facet value ID to each row.
     * @param csvData - An array of CSV rows representing facet value data.
     * @param idsField - The field in the CSV data where the facet value ID(s) will be added.
     * @param codesField - The field in the CSV data containing the facet value code(s).
     * @returns {Promise<Array<any>>} - Returns the updated CSV data with facet value IDs added.
     * @throws Will throw an error if CSV data is not provided.
     */
    public async addFacetValueIds(csvData: Array<FacetCsvRow>, idsField: string, codesField: string): Promise<Array<any>> {
        this.ensureInitialized()

        if (!csvData) {
            throw Error("CSV data is required for adding facet value IDs.")
        }

        this.facetValueService = this.app.get(FacetValueService)
        const facetValues: Array<Translated<FacetValue>> | undefined = await this.facetValueService.findAll(this.ctx, this.channel.defaultLanguageCode)

        const updatedData = await Promise.all(
            csvData.map(async (row) => {
                const newRow: any = { ...row }

                const codesString = row[codesField as keyof FacetCsvRow] as string
                // an empty cell is no missing facet value, so empty codes are dropped before the lookup
                const codesArray = (codesString ?? "")
                    .split(";")
                    .map((code) => code.trim())
                    .filter(Boolean)

                const ids: Array<string> = []

                for (const code of codesArray) {
                    const facetValue = facetValues?.find((facetValue) => facetValue.code === code)

                    if (facetValue) {
                        ids.push(facetValue.id.toString())
                    } else {
                        console.log(`No facet value found for code: ${code}`)
                    }
                }

                // If multiple codes, join IDs with ';', otherwise just set the first
                newRow[idsField] = ids.length > 1 ? ids.join(";") : ids[0] || ""

                return newRow
            }),
        )

        return updatedData
    }
}
