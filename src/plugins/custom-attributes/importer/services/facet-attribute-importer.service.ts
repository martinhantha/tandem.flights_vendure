import { FacetAttributeService } from "../../entities/facetAttribute/service"
import { AttributePropertiesService } from "../../entities/attributeProperties/service"
import { UpdateFacetAttributeInput } from "src/gql/generated"
import { CustomCreateFacetAttributeMapper, CustomUpdateFacetAttributeMapper } from "../../types"
import { FacetAttributeCsvRow, createFacetAttributeMapper, updateFacetAttributeMapper } from "../mapper"
import { BaseImporterService, BaseImporterServiceOptions } from "../../../hantha-importer"
import { ID, VendureConfig } from "@vendure/core"

export interface FacetAttributeImporterServiceOptions extends BaseImporterServiceOptions {
    codeField?: string
    facetIdField?: string

    customCreateMapper?: CustomCreateFacetAttributeMapper
    customUpdateMapper?: CustomUpdateFacetAttributeMapper
}

export class FacetAttributeImporterService extends BaseImporterService {
    private facetAttributeService: FacetAttributeService
    private attributePropertiesService: AttributePropertiesService

    private codeField: string
    private facetIdField: string

    private customCreateMapper?: CustomCreateFacetAttributeMapper
    private customUpdateMapper?: CustomUpdateFacetAttributeMapper

    constructor(options?: FacetAttributeImporterServiceOptions) {
        super(options)

        this.codeField = options?.codeField || "code"
        this.facetIdField = options?.facetIdField || "facetId"

        this.customCreateMapper = options?.customCreateMapper
        this.customUpdateMapper = options?.customUpdateMapper
    }

    /**
     * Creates and initializes a new FacetAttributeImporterService instance.
     */
    public static async create(config: VendureConfig, options?: FacetAttributeImporterServiceOptions): Promise<FacetAttributeImporterService> {
        const service = new FacetAttributeImporterService(options)
        await service.initialize(config)
        return service
    }

    /**
     * Imports facet attributes from an array of CSV row objects.
     *
     * This method processes each row, determines if the facet attribute already exists
     * (by code and facetId), and either updates the existing attribute or creates a new one. It uses
     * optional custom mappers if provided, and tracks statistics for processed, created,
     * and updated records. Row errors are logged to the console.
     *
     * @param csvData - Array of parsed CSV row objects representing facet attributes.
     * @returns Promise<void>
     * @throws If CSV data is missing or if an unexpected error stops the import.
     */
    public async importFacetAttributes(csvData: Array<FacetAttributeCsvRow>): Promise<void> {
        this.ensureInitialized()

        if (!csvData) {
            throw new Error("CSV data is required for facet attributes import.")
        }

        this.resetCounters()

        try {
            for (const row of csvData) {
                this.incrementProcessedCount()

                this.facetAttributeService = this.app.get(FacetAttributeService)
                this.attributePropertiesService = this.app.get(AttributePropertiesService)

                const facetId: string = row[this.facetIdField as keyof FacetAttributeCsvRow] as string
                const code: string = row[this.codeField as keyof FacetAttributeCsvRow] as string

                const attributeProperty = await this.attributePropertiesService.findOneByCode(this.ctx, code)
                if (!attributeProperty) {
                    this.rowError(`${code}, facet ${facetId}`, `skipped, no attribute property with code '${code}'`)
                    continue
                }
                const attributePropertyId: string = attributeProperty.id.toString()

                const fetchResult = await this.facetAttributeService.findOneByFacetIdAndCode(this.ctx, facetId, code)

                if (fetchResult) {
                    await this.updateFacetAttribute(fetchResult.id.toString(), row, attributePropertyId)
                } else {
                    await this.createFacetAttribute(row, attributePropertyId)
                }
            }

            this.logStatistics()
        } catch (error) {
            this.abortImport("Facet attribute", error)
        }
    }

    /**
     * Creates a new facet attribute in Vendure.
     * @param row - The row from the CSV file containing facet attribute data.
     * @param attributePropertyId - The resolved AttributeProperty ID for the row's `code`.
     * @returns {Promise<void>}
     */
    private async createFacetAttribute(row: FacetAttributeCsvRow, attributePropertyId: string): Promise<void> {
        const code: string = row[this.codeField as keyof FacetAttributeCsvRow] as string
        if (!code) {
            this.rowError(undefined, `missing '${this.codeField}'`)
            return
        }

        const facetId: string = row[this.facetIdField as keyof FacetAttributeCsvRow] as string
        if (!facetId) {
            this.rowError(code, `missing '${this.facetIdField}'`)
            return
        }

        const mapper: CustomCreateFacetAttributeMapper = this.customCreateMapper ?? createFacetAttributeMapper
        const facetAttribute = mapper(row, attributePropertyId)

        if (!facetAttribute) {
            this.rowError(`${code}, facet ${facetId}`, "skipped, the mapper returned no data (the default mapper reads 'facet:id')")
            return
        }

        const result = await this.facetAttributeService.create(this.ctx, facetAttribute)

        if (result) {
            this.incrementCreatedCount()
        } else {
            this.rowError(`${code}, facet ${facetId}`, "facet attribute could not be created")
        }
    }

    /**
     * Updates an existing facet attribute in Vendure.
     * @param id - The ID of the facet attribute to update.
     * @param row - The row from the CSV file containing facet attribute data.
     * @param attributePropertyId - The resolved AttributeProperty ID for the row's `code`.
     * @returns {Promise<void>}
     */
    private async updateFacetAttribute(id: string, row: FacetAttributeCsvRow, attributePropertyId: string): Promise<void> {
        const code: string = row[this.codeField as keyof FacetAttributeCsvRow] as string
        if (!id) {
            this.rowError(code, `invalid facet attribute id '${id}'`)
            return
        }

        if (!code) {
            this.rowError(undefined, `missing '${this.codeField}'`)
            return
        }

        const facetId: string = row[this.facetIdField as keyof FacetAttributeCsvRow] as string
        if (!facetId) {
            this.rowError(code, `missing '${this.facetIdField}'`)
            return
        }

        const mapper: CustomUpdateFacetAttributeMapper = this.customUpdateMapper ?? updateFacetAttributeMapper
        const facetAttribute = mapper(id, row, attributePropertyId)

        if (!facetAttribute) {
            this.rowError(`${code}, facet ${facetId}`, "skipped, the mapper returned no data (the default mapper reads 'facet:id')")
            return
        }

        if (!facetAttribute.id) {
            facetAttribute.id = id // Ensure the facet ID is set for update
        }

        const result = await this.facetAttributeService.update(this.ctx, facetAttribute as UpdateFacetAttributeInput & { id: ID })

        if (result) {
            this.incrementUpdatedCount()
        } else {
            this.rowError(`${code}, facet ${facetId}`, `facet attribute ${id} could not be updated`)
        }
    }
}
