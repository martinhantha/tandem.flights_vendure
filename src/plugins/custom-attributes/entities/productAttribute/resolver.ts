import {
    Ctx,
    PaginatedList,
    RequestContext,
    Allow,
    Transaction,
    Translated,
    UserInputError,
    ID,
    Permission,
    ListQueryOptions,
} from '@vendure/core';
import { Args, Query, Resolver, Mutation } from '@nestjs/graphql';

import { ProductAttribute } from './entity';
import { ProductAttributeService } from './service';
import { productAttributePermission } from './permission';
import {
    DeletionResponse,
    MutationCreateProductAttributeArgs,
    MutationUpdateProductAttributeArgs,
    MutationDeleteProductAttributeArgs,
    QueryProductAttributesArgs,
    QueryProductAttributeArgs,
    UpdateProductAttributeInput,
} from 'src/gql/generated';

@Resolver()
export class ProductAttributeAdminResolver {
    constructor(private attributeService: ProductAttributeService) { }

    @Query()
    @Allow(Permission.Public)
    async productAttributes(
        @Ctx() ctx: RequestContext,
        @Args() args: QueryProductAttributesArgs,
    ): Promise<PaginatedList<Translated<ProductAttribute>>> {
        return this.attributeService.findAll(ctx, args.options as ListQueryOptions<ProductAttribute> | undefined);
    }

    @Query()
    @Allow(Permission.Public)
    async productAttribute(
        @Ctx() ctx: RequestContext,
        @Args() args: QueryProductAttributeArgs,
    ): Promise<Translated<ProductAttribute> | undefined> {
        const { id, productId } = args;

        if (id) {
            return this.attributeService.findOneById(ctx, id);
        } else if (productId && id) {
            return this.attributeService.findOneByProductIdAndId(ctx, productId, id);
        } else {
            throw new UserInputError(`Invalid input provided`);
        }
    }

    @Transaction()
    @Mutation()
    @Allow(productAttributePermission.Create)
    async createProductAttribute(
        @Ctx() ctx: RequestContext,
        @Args() args: MutationCreateProductAttributeArgs,
    ): Promise<Translated<ProductAttribute>> {
        const { input } = args;
        return this.attributeService.create(ctx, input);
    }

    @Transaction()
    @Mutation()
    @Allow(productAttributePermission.Update)
    async updateProductAttribute(
        @Ctx() ctx: RequestContext,
        @Args() args: MutationUpdateProductAttributeArgs,
    ): Promise<Translated<ProductAttribute>> {
        const { input }: MutationUpdateProductAttributeArgs = args;
        const attribute = await this.attributeService.findOneByProductIdAndId(
            ctx,
            input?.productId ?? '',
            input?.id as ID,
        );

        if (!attribute) {
            throw new UserInputError(`No attribute found with the provided details`);
        }

        return this.attributeService.update(ctx, {
            ...input,
            id: attribute.id,
        } as UpdateProductAttributeInput & { id: ID });
    }

    @Transaction()
    @Mutation()
    @Allow(productAttributePermission.Delete)
    async deleteProductAttribute(
        @Ctx() ctx: RequestContext,
        @Args() args: MutationDeleteProductAttributeArgs,
    ): Promise<DeletionResponse> {
        const { input } = args;

        if (!input?.id) {
            throw new UserInputError(`Attribute ID is required`);
        }

        return this.attributeService.delete(ctx, input.id);
    }
}