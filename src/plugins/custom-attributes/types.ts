import { CreateAttributePropertyInput, UpdateAttributePropertyInput, CreateFacetAttributeInput, UpdateFacetAttributeInput, CreateProductAttributeInput, UpdateProductAttributeInput, CreateProductVariantAttributeInput, UpdateProductVariantAttributeInput } from "src/gql/generated"

import { FacetAttribute } from "./entities/facetAttribute/entity"
import { ProductAttribute } from "./entities/productAttribute/entity"
import { ProductVariantAttribute } from "./entities/productVariantAttribute/entity"

declare module "@vendure/core/dist/entity/custom-entity-fields" {
    interface CustomProductFields {
        attributes: ProductAttribute[]
    }
    interface CustomProductVariantFields {
        attributes: ProductVariantAttribute[]
    }
    interface CustomFacetFields {
        attributes: FacetAttribute[]
    }
}

export type CustomCreateAttributePropertyMapper = (row: any) => CreateAttributePropertyInput | null
export type CustomUpdateAttributePropertyMapper = (id: string, row: any) => UpdateAttributePropertyInput | null

export type CustomCreateFacetAttributeMapper = (row: any, attributePropertyId: string) => CreateFacetAttributeInput | null
export type CustomUpdateFacetAttributeMapper = (id: string, row: any, attributePropertyId: string) => UpdateFacetAttributeInput | null

export type CustomCreateProductAttributeMapper = (row: any, attributePropertyId: string) => CreateProductAttributeInput | null
export type CustomUpdateProductAttributeMapper = (id: string, row: any, attributePropertyId: string) => UpdateProductAttributeInput | null

export type CustomCreateProductVariantAttributeMapper = (row: any, attributePropertyId: string) => CreateProductVariantAttributeInput | null
export type CustomUpdateProductVariantAttributeMapper = (id: string, row: any, attributePropertyId: string) => UpdateProductVariantAttributeInput | null
