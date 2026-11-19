import {
    Ctx,
    PaginatedList,
    RequestContext,
    Allow,
    Transaction,
    Translated,
    UserInputError,
    Permission,
    ListQueryOptions,
} from '@vendure/core';
import { Args, Query, Resolver, Mutation } from '@nestjs/graphql';

import { AttributeProperty } from './entity';
import { AttributePropertiesService } from './service';
import { attributePropertiesPermission } from './permission'; // Reuse same permission

import {
    MutationCreateAttributePropertyArgs,
    MutationUpdateAttributePropertyArgs,
    QueryAttributePropertyArgs,
    QueryAttributePropertyByCodeArgs,
    QueryAttributePropertiesArgs,
} from 'src/gql/generated';
import { DeletionResponse } from '@vendure/common/lib/generated-types';

@Resolver()
export class AttributePropertiesAdminResolver {
    constructor(private attributePropertiesService: AttributePropertiesService) {}

    @Query()
    @Allow(Permission.Public)
    async attributeProperties(
        @Ctx() ctx: RequestContext,
        @Args() args: QueryAttributePropertiesArgs,
    ): Promise<PaginatedList<Translated<AttributeProperty>>> {
        return this.attributePropertiesService.findAll(ctx, args.options as ListQueryOptions<AttributeProperty>);
    }

    @Query()
    @Allow(Permission.Public)
    async attributeProperty(
        @Ctx() ctx: RequestContext,
        @Args() args: QueryAttributePropertyArgs,
    ): Promise<Translated<AttributeProperty> | undefined> {
        const { id } = args;

        if (!id) {
            throw new UserInputError('error.attribute-property-id-must-be-provided');
        }

        return this.attributePropertiesService.findOne(ctx, id);
    }

    @Query()
    @Allow(Permission.Public)
    async attributePropertyByCode(
        @Ctx() ctx: RequestContext,
        @Args() args: QueryAttributePropertyByCodeArgs,
    ): Promise<Translated<AttributeProperty> | undefined> {
        const { code } = args;

        if (!code) {
            throw new UserInputError('error.attribute-property-code-must-be-provided');
        }

        return this.attributePropertiesService.findOneByCode(ctx, code);
    }

    @Transaction()
    @Mutation()
    @Allow(attributePropertiesPermission.Create)
    async createAttributeProperty(
        @Ctx() ctx: RequestContext,
        @Args() args: MutationCreateAttributePropertyArgs,
    ): Promise<Translated<AttributeProperty>> {
        const { input } = args;
        return this.attributePropertiesService.create(ctx, input);
    }

    @Transaction()
    @Mutation()
    @Allow(attributePropertiesPermission.Update)
    async updateAttributeProperty(
        @Ctx() ctx: RequestContext,
        @Args() args: MutationUpdateAttributePropertyArgs,
    ): Promise<Translated<AttributeProperty>> {
        const { input } = args;
        return this.attributePropertiesService.update(ctx, input);
    }

    @Transaction()
    @Mutation()
    @Allow(attributePropertiesPermission.Delete)
    async deleteAttributeProperty(
        @Ctx() ctx: RequestContext,
        @Args('id') id: string,
    ): Promise<DeletionResponse> {
        return this.attributePropertiesService.delete(ctx, id);
    }
}