import { Resolver, ResolveField, Parent } from "@nestjs/graphql"
import { SearchResult } from "@vendure/common/lib/generated-types"
import { CollectionService, Ctx, ProductVariant, ProductVariantService, RequestContext, Translated } from "@vendure/core"

@Resolver("SearchResult")
export class SearchResultResolver {
    constructor(private collectionService: CollectionService, private productVariantService: ProductVariantService) {}

    @ResolveField()
    async fullSlug(@Ctx() ctx: RequestContext, @Parent() searchResult: SearchResult): Promise<string> {
        if (!searchResult.productId) {
            return "" // Fallback if there's no product ID
        }

        const productSlug = searchResult.slug
        const collection = await this.collectionService.findOne(ctx, searchResult.collectionIds[0])

        if (!collection) {
            return productSlug // Return empty if product not found
        }
        return `${collection.slug}/${productSlug}`
    }
    @ResolveField()
    async fullProductVariant(@Ctx() ctx: RequestContext, @Parent() searchResult: SearchResult): Promise<Translated<ProductVariant> | undefined> {
        if (!searchResult.productVariantId) {
            return undefined // Fallback if there's no product ID
        }
        const productVariant = await this.productVariantService.findOne(ctx, searchResult.productVariantId)
        if (!productVariant || !productVariant.product.enabled) {
            return undefined // Return undefined if product variant not found or product is disabled
        }
        return this.productVariantService.findOne(ctx, searchResult.productVariantId)
    }
}
