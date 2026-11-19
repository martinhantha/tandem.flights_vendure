import { ProductVariantAttributeService } from "../../entities/productVariantAttribute/service"
import { AttributePropertiesService } from "../../entities/attributeProperties/service"
import { UpdateProductVariantAttributeInput } from "src/gql/generated"
import { CustomCreateProductVariantAttributeMapper, CustomUpdateProductVariantAttributeMapper } from "../../types"
import { ProductVariantAttributeCsvRow, createProductVariantAttributeMapper, updateProductVariantAttributeMapper } from "../mapper"
import { BaseImporterService, BaseImporterServiceOptions } from "../../../hantha-importer"
import { ID, VendureConfig } from "@vendure/core"

export interface ProductVariantAttributeImporterServiceOptions extends BaseImporterServiceOptions {
    codeField?: string
    productVariantIdField?: string

    customCreateMapper?: CustomCreateProductVariantAttributeMapper
    customUpdateMapper?: CustomUpdateProductVariantAttributeMapper
}

export class ProductVariantAttributeImporterService extends BaseImporterService {
    private productVariantAttributeService: ProductVariantAttributeService
    private attributePropertiesService: AttributePropertiesService

    private codeField: string
    private productVariantIdField: string

    private customCreateMapper?: CustomCreateProductVariantAttributeMapper
    private customUpdateMapper?: CustomUpdateProductVariantAttributeMapper

    constructor(options?: ProductVariantAttributeImporterServiceOptions) {
        super(options)

        this.codeField = options?.codeField || "code"
        this.productVariantIdField = options?.productVariantIdField || "productVariantId"

        this.customCreateMapper = options?.customCreateMapper
        this.customUpdateMapper = options?.customUpdateMapper
    }

    /**
     * Creates and initializes a new ProductVariantAttributeImporterService instance.
     */
    public static async create(config: VendureConfig, options?: ProductVariantAttributeImporterServiceOptions): Promise<ProductVariantAttributeImporterService> {
        const service = new ProductVariantAttributeImporterService(options)
        await service.initialize(config)
        return service
    }

    /**
     * Imports product variant attributes from an array of CSV row objects.
     *
     * This method processes each row, determines if the product variant attribute already exists
     * (by code and productVariantId), and either updates the existing attribute or creates a new one. It uses
     * optional custom mappers if provided, and tracks statistics for processed, created,
     * and updated records. Row errors are logged to the console.
     *
     * @param csvData - Array of parsed CSV row objects representing product variant attributes.
     * @returns Promise<void>
     * @throws If CSV data is missing or if an unexpected error stops the import.
     */
    public async importProductVariantAttributes(csvData: Array<ProductVariantAttributeCsvRow>): Promise<void> {
        this.ensureInitialized()

        if (!csvData) {
            throw new Error("CSV data is required for product variant attributes import.")
        }

        this.resetCounters()

        try {
            for (const row of csvData) {
                this.incrementProcessedCount()

                this.productVariantAttributeService = this.app.get(ProductVariantAttributeService)
                this.attributePropertiesService = this.app.get(AttributePropertiesService)

                const productVariantId: string = row[this.productVariantIdField as keyof ProductVariantAttributeCsvRow] as string
                const code: string = row[this.codeField as keyof ProductVariantAttributeCsvRow] as string

                const attributeProperty = await this.attributePropertiesService.findOneByCode(this.ctx, code)
                if (!attributeProperty) {
                    this.rowError(`${code}, variant ${productVariantId}`, `skipped, no attribute property with code '${code}'`)
                    continue
                }
                const attributePropertyId: string = attributeProperty.id.toString()

                const fetchResult = await this.productVariantAttributeService.findOneByProductVariantIdAndCode(this.ctx, productVariantId, code)

                if (fetchResult) {
                    await this.updateProductVariantAttribute(fetchResult.id.toString(), row, attributePropertyId)
                } else {
                    await this.createProductVariantAttribute(row, attributePropertyId)
                }
            }

            this.logStatistics()
        } catch (error) {
            this.abortImport("Product variant attribute", error)
        }
    }

    /**
     * Creates a new product variant attribute in Vendure.
     * @param row - The row from the CSV file containing product variant attribute data.
     * @returns {Promise<void>}
     */
    private async createProductVariantAttribute(row: ProductVariantAttributeCsvRow, attributePropertyId: string): Promise<void> {
        const code = row[this.codeField as keyof ProductVariantAttributeCsvRow] as string
        const productVariantId = row[this.productVariantIdField as keyof ProductVariantAttributeCsvRow] as string

        const mapper: CustomCreateProductVariantAttributeMapper = this.customCreateMapper ?? createProductVariantAttributeMapper
        const productVariantAttribute = mapper(row, attributePropertyId)

        if (!productVariantAttribute) {
            this.rowError(`${code}, variant ${productVariantId}`, "skipped, the mapper returned no data (the default mapper reads 'productVariant:id')")
            return
        }

        const result = await this.productVariantAttributeService.create(this.ctx, productVariantAttribute)

        if (result) {
            this.incrementCreatedCount()
        } else {
            this.rowError(`${code}, variant ${productVariantId}`, "product variant attribute could not be created")
        }
    }

    /**
     * Updates an existing product variant attribute in Vendure.
     * @param id - The ID of the product variant attribute to update.
     * @param row - The row from the CSV file containing product variant attribute data.
     * @returns {Promise<void>}
     */
    private async updateProductVariantAttribute(id: string, row: ProductVariantAttributeCsvRow, attributePropertyId: string): Promise<void> {
        const code: string = row[this.codeField as keyof ProductVariantAttributeCsvRow] as string
        if (!id) {
            this.rowError(code, `invalid product variant attribute id '${id}'`)
            return
        }

        if (!code) {
            this.rowError(undefined, `missing '${this.codeField}'`)
            return
        }

        const productVariantId = row[this.productVariantIdField as keyof ProductVariantAttributeCsvRow] as string
        if (!productVariantId) {
            this.rowError(code, `missing '${this.productVariantIdField}'`)
            return
        }

        const mapper: CustomUpdateProductVariantAttributeMapper = this.customUpdateMapper ?? updateProductVariantAttributeMapper
        const productVariantAttribute = mapper(id, row, attributePropertyId)

        if (!productVariantAttribute) {
            this.rowError(`${code}, variant ${productVariantId}`, "skipped, the mapper returned no data (the default mapper reads 'productVariant:id')")
            return
        }

        if (!productVariantAttribute.id) {
            productVariantAttribute.id = id // Ensure the product variant ID is set for update
        }

        const result = await this.productVariantAttributeService.update(this.ctx, productVariantAttribute as UpdateProductVariantAttributeInput & { id: ID })

        if (result) {
            this.incrementUpdatedCount()
        } else {
            this.rowError(`${code}, variant ${productVariantId}`, `product variant attribute ${id} could not be updated`)
        }
    }
}
