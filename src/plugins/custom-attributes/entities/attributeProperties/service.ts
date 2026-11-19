import {
    ListQueryBuilder,
    ListQueryOptions,
    PaginatedList,
    RequestContext,
    TransactionalConnection,
    ID,
    Translated,
    TranslatorService,
    TranslatableSaver,
    assertFound,
    idsAreEqual,
} from '@vendure/core';
import { Injectable } from '@nestjs/common';

import { AttributeProperty } from './entity';
import { AttributePropertyTranslation } from './translation.entity';
import {
    CreateAttributePropertyInput,
    UpdateAttributePropertyInput,
} from 'src/gql/generated';
import { DeletionResponse, DeletionResult } from '@vendure/common/lib/generated-types';

@Injectable()
export class AttributePropertiesService {
    constructor(
        private connection: TransactionalConnection,
        private listQueryBuilder: ListQueryBuilder,
        private translatableSaver: TranslatableSaver,
        private translator: TranslatorService,
    ) {}

    async findAll(
        ctx: RequestContext,
        options?: ListQueryOptions<AttributeProperty>,
    ): Promise<PaginatedList<Translated<AttributeProperty>>> {
        const query = this.listQueryBuilder.build(AttributeProperty, options, {
            ctx,
        });
        return query.getManyAndCount().then(async ([properties, totalItems]) => {
            const items = properties.map((property) => this.translator.translate(property, ctx));
            return {
                items,
                totalItems,
            };
        });
    }

    async findOne(ctx: RequestContext, id: ID): Promise<Translated<AttributeProperty> | undefined> {
        const property = await this.connection.getRepository(ctx, AttributeProperty).findOne({
            where: {
                id,
            },
        });
        if (!property) {
            return;
        }
        return this.translator.translate(property, ctx);
    }

    async findOneByCode(ctx: RequestContext, code: string): Promise<Translated<AttributeProperty> | undefined> {
        const property = await this.connection.getRepository(ctx, AttributeProperty).findOne({
            where: {
                code,
            },
        });
        if (!property) {
            return;
        }
        return this.translator.translate(property, ctx);
    }

    async create(ctx: RequestContext, input: CreateAttributePropertyInput): Promise<Translated<AttributeProperty>> {
        const property = await this.translatableSaver.create({
            ctx,
            input,
            entityType: AttributeProperty,
            translationType: AttributePropertyTranslation,
            beforeSave: async (entity) => {
                await this.validateUniqueCode(ctx, entity.code);
            },
        });

        return assertFound(this.findOne(ctx, property.id));
    }

    async update(ctx: RequestContext, input: UpdateAttributePropertyInput): Promise<Translated<AttributeProperty>> {
        const property = await this.connection.getEntityOrThrow(ctx, AttributeProperty, input.id as ID);
        const updatedProperty = await this.translatableSaver.update({
            ctx,
            input: {
                ...input,
                id: property.id,
            },
            entityType: AttributeProperty,
            translationType: AttributePropertyTranslation,
        });

        return assertFound(this.findOne(ctx, updatedProperty.id));
    }

    async delete(ctx: RequestContext, id: ID): Promise<DeletionResponse> {
        const property = await this.connection.getEntityOrThrow(ctx, AttributeProperty, id);

        await this.connection.getRepository(ctx, AttributeProperty).delete(id);

        return {
            result: DeletionResult.DELETED,
        };
    }

    private async validateUniqueCode(ctx: RequestContext, code: string, id?: ID): Promise<void> {
        const existingProperty = await this.connection.getRepository(ctx, AttributeProperty).findOne({
            where: {
                code,
            },
        });

        if (existingProperty && (!id || !idsAreEqual(existingProperty.id, id))) {
            throw new Error(`An attribute property with code '${code}' already exists`);
        }
    }
}