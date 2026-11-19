import { Ctx, PaginatedList, RequestContext, Allow, ProductVariantService, Product } from "@vendure/core"
import { Args, Query, Resolver } from "@nestjs/graphql"

import { BestsellerService } from "./service"
import { bestsellerPermission } from "./permission"
import { Bestseller } from "./entity"

@Resolver()
export class BestsellerAdminResolver {
    constructor(private bestsellerService: BestsellerService, private productVariantService: ProductVariantService) {}

    @Query()
    @Allow(bestsellerPermission.Read)
    async bestsellers(@Ctx() ctx: RequestContext, @Args() args: any): Promise<PaginatedList<Bestseller>> {
        return this.bestsellerService.findAll(ctx, args.options || undefined)
    }
    @Query()
    async bestsellerProducts(@Ctx() ctx: RequestContext, @Args() args: any): Promise<PaginatedList<Product>> {
        return this.bestsellerService.findAllProducts(ctx, args.options || undefined)
    }
    @Query()
    async bestsellerMap(@Ctx() ctx: RequestContext, @Args() args: any): Promise<PaginatedList<Bestseller>> {
        return this.bestsellerService.findBestsellerMap(ctx, args.options || undefined)
    }
}
