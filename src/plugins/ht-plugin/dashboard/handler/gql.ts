import { graphql } from "@vendure/dashboard"

export const UPDATE_PRODUCT_SORTING = graphql(`
    mutation UpdateProductSorting($input: UpdateProductInput!) {
        updateProduct(input: $input) {
            id
            customFields {
                sorting
            }
        }
    }
`)

export const PRODUCT_SORTING_LIST = graphql(`
    query ProductSortingList($options: ProductListOptions) {
        products(options: $options) {
            items {
                id
                customFields {
                    sorting
                }
            }
            totalItems
        }
    }
`)
export const UPDATE_PRODUCT_VARIANT_SORTING = graphql(`
    mutation UpdateProductVariantSorting($input: UpdateProductVariantInput!) {
        updateProductVariant(input: $input) {
            id
            customFields {
                sorting
            }
        }
    }
`)

export const PRODUCT_VARIANT_SORTING_LIST = graphql(`
    query ProductVariantSortingList($options: ProductVariantListOptions) {
        productVariants(options: $options) {
            items {
                id
                customFields {
                    sorting
                }
            }
            totalItems
        }
    }
`)