import { CreateAssetInput, CreateCollectionInput, CreateFacetInput, CreateFacetValueInput, CreateProductInput, CreateProductOptionGroupInput, CreateProductOptionInput, CreateProductVariantInput, CreateTaxCategoryInput, InputMaybe, Scalars, UpdateAssetInput, UpdateCollectionInput, UpdateFacetInput, UpdateProductInput, UpdateProductOptionGroupInput, UpdateProductOptionInput, UpdateProductVariantInput, UpdateTaxCategoryInput } from "@vendure/common/lib/generated-types"

export type CustomFieldInput = InputMaybe<Scalars["JSON"]["input"]>
export type CustomFieldMapper = (row: any) => CustomFieldInput
export type CustomFieldMappers = Array<CustomFieldMapper>

// ---------------------------------------------------------> TAX CATEGORY
export type CustomCreateTaxCategoryMapper = (row: any, customFieldMappers?: CustomFieldMappers) => CreateTaxCategoryInput | null
export type CustomUpdateTaxCategoryMapper = (id: string, row: any, customFieldMappers?: CustomFieldMappers) => UpdateTaxCategoryInput | null
// ---------------------------------------------------------> ASSET
export type CustomCreateAssetMapper = (assetRootPath: string, row: any, customFieldMappers?: CustomFieldMappers, customFieldTranslationMappers?: CustomFieldMappers) => CreateAssetInput | null
export type CustomUpdateAssetMapper = (id: string, row: any, customFieldMappers?: CustomFieldMappers, customFieldTranslationMappers?: CustomFieldMappers) => UpdateAssetInput | null

// ---------------------------------------------------------> COLLECTION
export type CustomCreateCollectionMapper = (row: any, customFieldMappers?: CustomFieldMappers, customFieldTranslationMappers?: CustomFieldMappers) => CreateCollectionInput | null
export type CustomUpdateCollectionMapper = (id: string, row: any, customFieldMappers?: CustomFieldMappers, customFieldTranslationMappers?: CustomFieldMappers) => UpdateCollectionInput | null

// ---------------------------------------------------------> FACET
export type CustomCreateFacetMapper = (row: any, customFieldMappers?: CustomFieldMappers, customFieldTranslationMappers?: CustomFieldMappers) => CreateFacetInput | null
export type CustomUpdateFacetMapper = (id: string, row: any, customFieldMappers?: CustomFieldMappers, customFieldTranslationMappers?: CustomFieldMappers) => UpdateFacetInput | null

// ---------------------------------------------------------> FACET VALUE
export type CustomCreateFacetValuesMapper = (facetId: string, row: any, customFieldMappers?: CustomFieldMappers, customFieldTranslationMappers?: CustomFieldMappers) => Array<CreateFacetValueInput> | null

// ---------------------------------------------------------> PRODUCT
export type CustomCreateProductMapper = (row: any, customFieldMappers?: CustomFieldMappers, customFieldTranslationMappers?: CustomFieldMappers) => CreateProductInput | null
export type CustomUpdateProductMapper = (id: string, row: any, customFieldMappers?: CustomFieldMappers, customFieldTranslationMappers?: CustomFieldMappers) => UpdateProductInput | null

// ---------------------------------------------------------> PRODUCT OPTION GROUP
export type CustomCreateProductOptionGroupMapper = (row: any, customFieldMappers?: CustomFieldMappers, customFieldTranslationMappers?: CustomFieldMappers) => CreateProductOptionGroupInput | null
export type CustomUpdateProductOptionGroupMapper = (id: string, row: any, customFieldMappers?: CustomFieldMappers, customFieldTranslationMappers?: CustomFieldMappers) => UpdateProductOptionGroupInput | null

// ---------------------------------------------------------> PRODUCT OPTION
export type CustomCreateProductOptionMapper = (groupId: string, row: any, customFieldMappers?: CustomFieldMappers, customFieldTranslationMappers?: CustomFieldMappers) => CreateProductOptionInput | null
export type CustomUpdateProductOptionMapper = (id: string, row: any, customFieldMappers?: CustomFieldMappers, customFieldTranslationMappers?: CustomFieldMappers) => UpdateProductOptionInput | null

// ---------------------------------------------------------> PRODUCT VARIANT
export type CustomCreateProductVariantMapper = (productId: string, row: any, customFieldMappers?: CustomFieldMappers, customFieldTranslationMappers?: CustomFieldMappers) => CreateProductVariantInput | null
export type CustomUpdateProductVariantMapper = (id: string, row: any, customFieldMappers?: CustomFieldMappers, customFieldTranslationMappers?: CustomFieldMappers) => UpdateProductVariantInput | null
