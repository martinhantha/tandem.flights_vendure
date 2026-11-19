import { Parent, ResolveField, Resolver } from "@nestjs/graphql"
import { Ctx, RequestContext, ProductVariant, ProductVariantPrice, ProductPriceApplicator } from "@vendure/core"

@Resolver("ProductVariant")
export class ProductVariantEntityResolver {
    constructor(private productPriceApplicator: ProductPriceApplicator) {}

    @ResolveField()
    async referencePrice(@Ctx() ctx: RequestContext, @Parent() variant: ProductVariant) {
        return (await this.applyReferencePrice(ctx, variant))?.price ?? 0
    }

    @ResolveField()
    async referencePriceWithTax(@Ctx() ctx: RequestContext, @Parent() variant: ProductVariant) {
        return (await this.applyReferencePrice(ctx, variant))?.priceWithTax ?? 0
    }

    // runs the reference price through the same price/tax calculation as the regular price,
    // so it is net or gross depending on the channel's "prices include tax" setting, just like price/priceWithTax
    private async applyReferencePrice(ctx: RequestContext, variant: ProductVariant) {
        if (!variant.productVariantPrices?.some((p) => p.customFields?.referencePrice)) return undefined

        // copy, so the calculated price of the original variant stays untouched
        const referenceVariant = new ProductVariant(variant)
        referenceVariant.productVariantPrices = variant.productVariantPrices.map((p) => new ProductVariantPrice({ ...p, price: p.customFields?.referencePrice ?? 0 }))
        return this.productPriceApplicator.applyChannelPriceAndTax(referenceVariant, ctx)
    }
}
