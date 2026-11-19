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

import { FacetAttribute } from './entity';
import { FacetAttributeService } from './service';
import { facetAttributePermission } from './permission';
import {
    MutationCreateFacetAttributeArgs,
    MutationUpdateFacetAttributeArgs,
    MutationDeleteFacetAttributeArgs,
    QueryFacetAttributesArgs,
    QueryFacetAttributeArgs,
    UpdateFacetAttributeInput,
} from 'src/gql/generated';
import { DeletionResponse } from '@vendure/common/lib/generated-types';

@Resolver()
export class FacetAttributeAdminResolver {
    constructor(private attributeService: FacetAttributeService) {}

    @Query()
    @Allow(Permission.Public)
    async facetAttributes(
        @Ctx() ctx: RequestContext,
        @Args() args: QueryFacetAttributesArgs,
    ): Promise<PaginatedList<Translated<FacetAttribute>>> {
        return this.attributeService.findAll(ctx, args.options as ListQueryOptions<FacetAttribute>);
    }

    @Query()
    @Allow(Permission.Public)
    async facetAttribute(
        @Ctx() ctx: RequestContext,
        @Args() args: QueryFacetAttributeArgs,
    ): Promise<Translated<FacetAttribute> | undefined> {
        const { id, facetId } = args;

        if (id) {
            return this.attributeService.findOneById(ctx, id);
        } else if (facetId && id) {
            return this.attributeService.findOneByFacetIdAndId(ctx, facetId, id);
        } else {
            throw new UserInputError(`Invalid input provided`);
        }
    }

    @Transaction()
    @Mutation()
    @Allow(facetAttributePermission.Create)
    async createFacetAttribute(
        @Ctx() ctx: RequestContext,
        @Args() args: MutationCreateFacetAttributeArgs,
    ): Promise<Translated<FacetAttribute>> {
        const { input } = args;
        return this.attributeService.create(ctx, input);
    }

    @Transaction()
    @Mutation()
    @Allow(facetAttributePermission.Update)
    async updateFacetAttribute(
        @Ctx() ctx: RequestContext,
        @Args() args: MutationUpdateFacetAttributeArgs,
    ): Promise<Translated<FacetAttribute>> {
        const { input }: MutationUpdateFacetAttributeArgs = args;
        const attribute = await this.attributeService.findOneByFacetIdAndId(
            ctx,
            input?.facetId as ID,
            input?.id as ID,
        );

        if (!attribute) {
            throw new UserInputError(`No attribute found with the provided details`);
        }

        return this.attributeService.update(ctx, {
            ...input,
            id: attribute.id as ID,
        } as UpdateFacetAttributeInput & { id: ID });
    }

    @Transaction()
    @Mutation()
    @Allow(facetAttributePermission.Delete)
    async deleteFacetAttribute(
        @Ctx() ctx: RequestContext,
        @Args() args: MutationDeleteFacetAttributeArgs,
    ): Promise<DeletionResponse> {
        const { input } = args;

        if (!input?.id) {
            throw new UserInputError(`Attribute ID is required`);
        }

        return this.attributeService.delete(ctx, input.id);
    }
}