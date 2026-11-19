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
    Product,
} from '@vendure/core';
import { Injectable } from '@nestjs/common';
import { ProductAttributeTranslation } from './translation.entity';
import { ProductAttribute } from './entity';
import { AttributeProperty } from '../attributeProperties/entity';
import { CreateProductAttributeInput, UpdateProductAttributeInput } from 'src/gql/generated';
import { DeletionResponse, DeletionResult } from '@vendure/common/lib/generated-types';

@Injectable()
export class ProductAttributeService {
    constructor(
        private connection: TransactionalConnection,
        private listQueryBuilder: ListQueryBuilder,
        private translatableSaver: TranslatableSaver,
        private translator: TranslatorService,
    ) {}

    /**
     * Vendure's TranslatorService returns `undefined` for translated fields if the requested language
     * has no translation row. Since our GraphQL schema declares `value: String!`, we must guarantee
     * a non-null string to avoid list/detail queries failing entirely.
     */
    private translateWithValueFallback(
        attribute: ProductAttribute,
        ctx: RequestContext,
    ): Translated<ProductAttribute> {
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

        return translated as Translated<ProductAttribute>;
    }

    async findAll(
        ctx: RequestContext,
        options?: ListQueryOptions<ProductAttribute>,
    ): Promise<PaginatedList<Translated<ProductAttribute>>> {
        const query = this.listQueryBuilder.build(ProductAttribute, options, {
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

    async findOneByProductIdAndId(
        ctx: RequestContext,
        productId: ID,
        id: ID,
    ): Promise<Translated<ProductAttribute> | undefined> {
        const attribute = await this.connection.getRepository(ctx, ProductAttribute).findOne({
            where: {
                productId: productId,
                id,
            },
        });
        if (!attribute) {
            return;
        }
        return this.translateWithValueFallback(attribute, ctx);
    }

    async findOneByProductIdAndCode(
        ctx: RequestContext,
        productId: ID,
        code: string,
    ): Promise<Translated<ProductAttribute> | undefined> {
        const attribute = await this.connection.getRepository(ctx, ProductAttribute).findOne({
            where: {
                productId: productId,
                attributeProperty: {
                    code: code,
                },
            },
        });
        if (!attribute) {
            return;
        }
        return this.translateWithValueFallback(attribute, ctx);
    }

    async findOneById(ctx: RequestContext, id: ID): Promise<Translated<ProductAttribute> | undefined> {
        const attribute = await this.connection.getRepository(ctx, ProductAttribute).findOne({
            where: {
                id: id,
            },
        });

        if (!attribute) {
            return;
        }

        return this.translateWithValueFallback(attribute, ctx);
    }

    async create(ctx: RequestContext, input: CreateProductAttributeInput): Promise<Translated<ProductAttribute>> {
        const product = await this.connection.getEntityOrThrow(ctx, Product, input.productId);

        // Validate that the attribute property exists
        if (!input.attributePropertyId) {
            throw new Error('Attribute property not found');
        }
        const attributeProperty = await this.connection.getRepository(ctx, AttributeProperty).findOne({
            where: {
                id: input.attributePropertyId,
            },
        });
        if (!attributeProperty) {
            throw new Error('Attribute property not found');
        }

        const attribute = <ProductAttribute>await this.translatableSaver.create({
            ctx,
            input,
            entityType: ProductAttribute,
            translationType: ProductAttributeTranslation,
        });

        return assertFound(this.findOneByProductIdAndId(ctx, attribute.productId, attribute.id));
    }

    async update(
        ctx: RequestContext,
        input: UpdateProductAttributeInput & { id: ID },
    ): Promise<Translated<ProductAttribute>> {
        const updatedAttribute = await this.translatableSaver.update({
            ctx,
            input,
            entityType: ProductAttribute,
            translationType: ProductAttributeTranslation,
        });

        if (!updatedAttribute) {
            throw new Error('ProductAttribute not found');
        }
        const product = await this.connection.getEntityOrThrow(ctx, Product, updatedAttribute.productId);
        const existingAttribute = product.customFields.attributes.find(
            (attribute) => attribute.id === updatedAttribute.id,
        );
        if (existingAttribute) {
            existingAttribute.translations = updatedAttribute.translations.map((translation) => ({
                ...translation,
                updatedAt: new Date(),
            }));
        } else {
            product.customFields.attributes.push({
                ...updatedAttribute,
                translations: updatedAttribute.translations.map((translation) => ({
                    ...translation,
                    updatedAt: new Date(),
                })),
            });
        }

        return assertFound(this.findOneById(ctx, updatedAttribute.id));
    }

    async delete(ctx: RequestContext, attributeId: ID): Promise<DeletionResponse> {
        const attribute = await this.connection.getEntityOrThrow(ctx, ProductAttribute, attributeId, {
            relationLoadStrategy: 'query',
            loadEagerRelations: false,
        });

        // Remove the attribute from the product's customFields.attributes relation
        if (attribute.productId) {
            const product = await this.connection.getRepository(ctx, Product).findOne({
                where: { id: attribute.productId },
                relations: ['customFields.attributes'],
            });
            if (product && product.customFields?.attributes) {
                product.customFields.attributes = product.customFields.attributes.filter(
                    (attr) => String(attr.id) !== String(attributeId),
                );
                await this.connection.getRepository(ctx, Product).save(product);
            }
        }

        await this.connection.getRepository(ctx, ProductAttribute).delete(attributeId);

        return {
            result: DeletionResult.DELETED,
        };
    }
}