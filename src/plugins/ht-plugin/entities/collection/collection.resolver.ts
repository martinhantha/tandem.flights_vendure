import { Resolver, ResolveField, Parent, Args } from "@nestjs/graphql"
import { Collection, Ctx, Product, RequestContext } from "@vendure/core"
import { MyCollectionService } from "./collection.service"

@Resolver("Collection")
export class MyCollectionResolver {
    constructor(private myCollectionService: MyCollectionService) {}

    @ResolveField()
    async products(@Ctx() ctx: RequestContext, @Parent() collection: Collection, @Args() args: any)
    : Promise<{ items: Product[]; totalItems: number }> {
        
        const result = await this.myCollectionService.getProductsForCollection(ctx, collection.id, args?.options)

        // Ensure it always returns an array
        return {
            items: result.items,
            totalItems: result.totalItems
        }
    }
}
