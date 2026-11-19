import { ProductAttributeService } from "../../entities/productAttribute/service"
import { AttributePropertiesService } from "../../entities/attributeProperties/service"
import { UpdateProductAttributeInput } from "src/gql/generated"
import { CustomCreateProductAttributeMapper, CustomUpdateProductAttributeMapper } from "../../types"
import { ProductAttributeCsvRow, createProductAttributeMapper, updateProductAttributeMapper } from "../mapper"
import { BaseImporterService, BaseImporterServiceOptions } from "../../../hantha-importer"
import { ID, VendureConfig } from "@vendure/core"

export interface ProductAttributeImporterServiceOptions extends BaseImporterServiceOptions {
    codeField?: string
    productIdField?: string

    customCreateMapper?: CustomCreateProductAttributeMapper
    customUpdateMapper?: CustomUpdateProductAttributeMapper
}

export class ProductAttributeImporterService extends BaseImporterService {
    private productAttributeService: ProductAttributeService
    private attributePropertiesService: AttributePropertiesService

    private codeField: string
    private productIdField: string

    private customCreateMapper?: CustomCreateProductAttributeMapper
    private customUpdateMapper?: CustomUpdateProductAttributeMapper

    constructor(options?: ProductAttributeImporterServiceOptions) {
        super(options)

        this.codeField = options?.codeField || "code"
        this.productIdField = options?.productIdField || "productId"

        this.customCreateMapper = options?.customCreateMapper
        this.customUpdateMapper = options?.customUpdateMapper
    }

    /**
     * Creates and initializes a new ImporterService instance.
     */
    public static async create(config: VendureConfig, options?: ProductAttributeImporterServiceOptions): Promise<ProductAttributeImporterService> {
        const service = new ProductAttributeImporterService(options)
        await service.initialize(config)
        return service
    }

    /**
     * Imports product attributes from an array of CSV row objects.
     *
     * This method processes each row, determines if the product attribute already exists
     * (by code and productId), and either updates the existing attribute or creates a new one. It uses
     * optional custom mappers if provided, and tracks statistics for processed, created,
     * and updated records. Row errors are logged to the console.
     *
     * @param csvData - Array of parsed CSV row objects representing product attributes.
     * @returns Promise<void>
     * @throws If CSV data is missing or if an unexpected error stops the import.
     */
    public async importProductAttributes(csvData: Array<ProductAttributeCsvRow>): Promise<void> {
        this.ensureInitialized()

        if (!csvData) {
            throw new Error("CSV data is required for product attributes import.")
        }

        this.resetCounters()

        try {
            for (const row of csvData) {
                this.incrementProcessedCount()

                this.productAttributeService = this.app.get(ProductAttributeService)
                this.attributePropertiesService = this.app.get(AttributePropertiesService)

                const productId: string = row[this.productIdField as keyof ProductAttributeCsvRow] as string
                const code: string = row[this.codeField as keyof ProductAttributeCsvRow] as string

                const attributeProperty = await this.attributePropertiesService.findOneByCode(this.ctx, code)
                if (!attributeProperty) {
                    this.rowError(`${code}, product ${productId}`, `skipped, no attribute property with code '${code}'`)
                    continue
                }
                const attributePropertyId: string = attributeProperty.id.toString()

                const fetchResult = await this.productAttributeService.findOneByProductIdAndCode(this.ctx, productId, code)

                if (fetchResult) {
                    await this.updateProductAttribute(fetchResult.id.toString(), row, attributePropertyId)
                } else {
                    await this.createProductAttribute(row, attributePropertyId)
                }
            }

            this.logStatistics()
        } catch (error) {
            this.abortImport("Product attribute", error)
        }
    }

    /**
     * Creates a new product attribute in Vendure.
     * @param row - The row from the CSV file containing product attribute data.
     * @returns {Promise<void>}
     */
    private async createProductAttribute(row: ProductAttributeCsvRow, attributePropertyId: string): Promise<void> {
        const code: string = row[this.codeField as keyof ProductAttributeCsvRow] as string
        if (!code) {
            this.rowError(undefined, `missing '${this.codeField}'`)
            return
        }

        const productId = row[this.productIdField as keyof ProductAttributeCsvRow] as string
        if (!productId) {
            this.rowError(code, `missing '${this.productIdField}'`)
            return
        }

        const mapper: CustomCreateProductAttributeMapper = this.customCreateMapper ?? createProductAttributeMapper
        const productAttribute = mapper(row, attributePropertyId)

        if (!productAttribute) {
            this.rowError(`${code}, product ${productId}`, "skipped, the mapper returned no data (the default mapper reads 'product:id')")
            return
        }

        const result = await this.productAttributeService.create(this.ctx, productAttribute)

        if (result) {
            this.incrementCreatedCount()
        } else {
            this.rowError(`${code}, product ${productId}`, "product attribute could not be created")
        }
    }

    /**
     * Updates an existing product attribute in Vendure.
     * @param id - The ID of the product attribute to update.
     * @param row - The row from the CSV file containing product attribute data.
     * @returns {Promise<void>}
     */
    private async updateProductAttribute(id: string, row: ProductAttributeCsvRow, attributePropertyId: string): Promise<void> {
        const code: string = row[this.codeField as keyof ProductAttributeCsvRow] as string
        if (!id) {
            this.rowError(code, `invalid product attribute id '${id}'`)
            return
        }

        if (!code) {
            this.rowError(undefined, `missing '${this.codeField}'`)
            return
        }

        const productId = row[this.productIdField as keyof ProductAttributeCsvRow] as string
        if (!productId) {
            this.rowError(code, `missing '${this.productIdField}'`)
            return
        }

        const mapper: CustomUpdateProductAttributeMapper = this.customUpdateMapper ?? updateProductAttributeMapper
        const productAttribute = mapper(id, row, attributePropertyId)

        if (!productAttribute) {
            this.rowError(`${code}, product ${productId}`, "skipped, the mapper returned no data (the default mapper reads 'product:id')")
            return
        }

        if (!productAttribute.id) {
            productAttribute.id = id // Ensure the product ID is set for update
        }

        const result = await this.productAttributeService.update(this.ctx, productAttribute as UpdateProductAttributeInput & { id: ID })

        if (result) {
            this.incrementUpdatedCount()
        } else {
            this.rowError(`${code}, product ${productId}`, `product attribute ${id} could not be updated`)
        }
    }
}
