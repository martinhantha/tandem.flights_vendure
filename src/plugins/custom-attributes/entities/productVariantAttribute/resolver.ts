import { Ctx, PaginatedList, RequestContext, Allow, Transaction, Translated, UserInputError, ID, Permission, ListQueryOptions } from "@vendure/core"
import { Args, Query, Resolver, Mutation } from "@nestjs/graphql"

import { ProductVariantAttribute } from "./entity"
import { ProductVariantAttributeService } from "./service"
import { productVariantAttributePermission } from "./permission"
import { MutationCreateProductVariantAttributeArgs, MutationUpdateProductVariantAttributeArgs, MutationDeleteProductVariantAttributeArgs, QueryProductVariantAttributesArgs, QueryProductVariantAttributeArgs, UpdateProductVariantAttributeInput } from "src/gql/generated"
import { DeletionResponse } from "@vendure/common/lib/generated-types"

@Resolver()
export class ProductVariantAttributeAdminResolver {
    constructor(private attributeService: ProductVariantAttributeService) { }

    @Query()
    @Allow(Permission.Public)
    async productVariantAttributes(@Ctx() ctx: RequestContext, @Args() args: QueryProductVariantAttributesArgs): Promise<PaginatedList<Translated<ProductVariantAttribute>>> {
        return this.attributeService.findAll(ctx, args.options as ListQueryOptions<ProductVariantAttribute> | undefined)
    }

    @Query()
    @Allow(Permission.Public)
    async productVariantAttribute(@Ctx() ctx: RequestContext, @Args() args: QueryProductVariantAttributeArgs): Promise<Translated<ProductVariantAttribute> | undefined> {
        const { id, productVariantId, code } = args

        if (id) {
            return this.attributeService.findOneById(ctx, id)
        } else if (productVariantId && code) {
            return this.attributeService.findOneByProductVariantIdAndCode(ctx, productVariantId, code)
        } else {
            throw new UserInputError(`Invalid input provided`)
        }
    }

    @Transaction()
    @Mutation()
    @Allow(productVariantAttributePermission.Create)
    async createProductVariantAttribute(@Ctx() ctx: RequestContext, @Args() args: MutationCreateProductVariantAttributeArgs): Promise<Translated<ProductVariantAttribute>> {
        const { input } = args
        return this.attributeService.create(ctx, input)
    }

    @Transaction()
    @Mutation()
    @Allow(productVariantAttributePermission.Update)
    async updateProductVariantAttribute(@Ctx() ctx: RequestContext, @Args() args: MutationUpdateProductVariantAttributeArgs): Promise<Translated<ProductVariantAttribute>> {
        const { input }: MutationUpdateProductVariantAttributeArgs = args
        const attribute = await this.attributeService.findOneByProductVariantIdAndId(ctx, input?.productVariantId as ID, input?.id as ID)

        if (!attribute) {
            throw new UserInputError(`No attribute found with the provided details`)
        }

        return this.attributeService.update(ctx, {
            ...input,
            id: attribute.id as ID,
        } as UpdateProductVariantAttributeInput & { id: ID })
    }

    @Transaction()
    @Mutation()
    @Allow(productVariantAttributePermission.Delete)
    async deleteProductVariantAttribute(@Ctx() ctx: RequestContext, @Args() args: MutationDeleteProductVariantAttributeArgs): Promise<DeletionResponse> {
        const { input } = args

        if (input.id === undefined) {
            throw new UserInputError(`No attribute id provided`)
        }
        const attribute = await this.attributeService.findOneById(ctx, input.id as ID)
        if (!attribute) {
            throw new UserInputError(`No attribute found with the provided details`)
        }

        return this.attributeService.delete(ctx, attribute.id)
    }
}