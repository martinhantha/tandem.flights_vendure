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
} from '@vendure/core';
import { Injectable } from '@nestjs/common';

import { FacetAttribute } from './entity';
import { FacetAttributeTranslation } from './translation.entity';
import {
    CreateFacetAttributeInput,
    UpdateFacetAttributeInput,
} from 'src/gql/generated';
import { DeletionResponse, DeletionResult } from '@vendure/common/lib/generated-types';

@Injectable()
export class FacetAttributeService {
    constructor(
        private connection: TransactionalConnection,
        private listQueryBuilder: ListQueryBuilder,
        private translatableSaver: TranslatableSaver,
        private translator: TranslatorService,
    ) {}

    /**
     * Ensure `value` and `languageCode` are always non-null to match the GraphQL schema.
     * Without this, a missing translation for the requested ctx.languageCode can make
     * list/detail queries fail (since `value: String!`).
     */
    private translateWithValueFallback(attribute: FacetAttribute, ctx: RequestContext): Translated<FacetAttribute> {
        const translated = this.translator.translate(attribute, ctx) as any;

        if (translated && (translated.languageCode == null || translated.languageCode === '')) {
            translated.languageCode = ctx.languageCode;
        }

        if (translated && (translated.value === undefined || translated.value === null)) {
            const translations = (attribute as any).translations ?? [];
            const current = translations.find((t: any) => t?.languageCode === ctx.languageCode);
            const fallback = current?.value ?? translations[0]?.value ?? '';
            translated.value = typeof fallback === 'string' ? fallback : String(fallback ?? '');
        } else if (translated && typeof translated.value !== 'string') {
            translated.value = String(translated.value ?? '');
        }

        return translated as Translated<FacetAttribute>;
    }

    async findAll(
        ctx: RequestContext,
        options?: ListQueryOptions<FacetAttribute>,
    ): Promise<PaginatedList<Translated<FacetAttribute>>> {
        const query = this.listQueryBuilder.build(FacetAttribute, options, {
            ctx,
            relations: ['attributeProperty'],
        });
        return query.getManyAndCount().then(async ([attributes, totalItems]) => {
            const items = attributes.map((attribute) => {
                const translatedAttribute = this.translateWithValueFallback(attribute, ctx);

                if (attribute.attributeProperty) {
                    translatedAttribute.attributeProperty = this.translator.translate(attribute.attributeProperty, ctx);
                }

                return translatedAttribute;
            });
            return {
                items,
                totalItems,
            };
        });
    }

    async findOneByFacetIdAndId(
        ctx: RequestContext,
        facetId: ID,
        id: ID,
    ): Promise<Translated<FacetAttribute> | undefined> {
        const attribute = await this.connection.getRepository(ctx, FacetAttribute).findOne({
            where: {
                facetId: facetId,
                id: id,
            },
        });
        if (!attribute) {
            return;
        }
        return this.translateWithValueFallback(attribute, ctx);
    }

    async findOneByFacetIdAndAttributePropertyId(
        ctx: RequestContext,
        facetId: ID,
        attributePropertyId: ID,
    ): Promise<Translated<FacetAttribute> | undefined> {
        const attribute = await this.connection.getRepository(ctx, FacetAttribute).findOne({
            where: {
                facetId: facetId,
                attributePropertyId: attributePropertyId,
            },
        });
        if (!attribute) {
            return;
        }
        return this.translateWithValueFallback(attribute, ctx);
    }

    async findOneByFacetIdAndCode(
        ctx: RequestContext,
        facetId: ID,
        code: string,
    ): Promise<Translated<FacetAttribute> | undefined> {
        const attribute = await this.connection.getRepository(ctx, FacetAttribute).findOne({
            where: {
                facetId: facetId,
                attributeProperty: {
                    code: code,
                },
            },
            relations: ['attributeProperty'],
        });
        if (!attribute) {
            return;
        }
        return this.translateWithValueFallback(attribute, ctx);
    }

    async findOneById(ctx: RequestContext, id: ID): Promise<Translated<FacetAttribute> | undefined> {
        const attribute = await this.connection.getRepository(ctx, FacetAttribute).findOne({
            where: {
                id: id,
            },
        });

        if (!attribute) {
            return;
        }

        return this.translateWithValueFallback(attribute, ctx);
    }

    async create(ctx: RequestContext, input: CreateFacetAttributeInput): Promise<Translated<FacetAttribute>> {
        const attribute = await this.translatableSaver.create({
            ctx,
            input,
            entityType: FacetAttribute,
            translationType: FacetAttributeTranslation,
        });

        return assertFound(this.findOneByFacetIdAndId(ctx, attribute.facetId, attribute.id));
    }

    async update(
        ctx: RequestContext,
        input: UpdateFacetAttributeInput & { id: ID },
    ): Promise<Translated<FacetAttribute>> {
        const updatedAttribute = await this.translatableSaver.update({
            ctx,
            input,
            entityType: FacetAttribute,
            translationType: FacetAttributeTranslation,
        });

        return assertFound(this.findOneById(ctx, updatedAttribute.id));
    }

    async delete(ctx: RequestContext, attributeId: ID): Promise<DeletionResponse> {
        const attribute = await this.connection.getEntityOrThrow(ctx, FacetAttribute, attributeId, {
            relationLoadStrategy: 'query',
            loadEagerRelations: false,
        });

        await this.connection.getRepository(ctx, FacetAttribute).delete(attributeId);

        return {
            result: DeletionResult.DELETED,
        };
    }
}