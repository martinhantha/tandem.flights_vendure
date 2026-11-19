import { ListQueryBuilder, ListQueryOptions, PaginatedList, RequestContext, TransactionalConnection, ID, Translated, TranslatorService, TranslatableSaver, assertFound } from "@vendure/core"
import { Injectable } from "@nestjs/common"

import { ProductVariantAttribute } from "./entity"
import { ProductVariantAttributeTranslation } from "./translation.entity"
import { CreateProductVariantAttributeInput, UpdateProductVariantAttributeInput } from "src/gql/generated"
import { DeletionResponse, DeletionResult } from "@vendure/common/lib/generated-types"

@Injectable()
export class ProductVariantAttributeService {
    constructor(
        private connection: TransactionalConnection,
        private listQueryBuilder: ListQueryBuilder,
        private translatableSaver: TranslatableSaver,
        private translator: TranslatorService
    ) {}

    /**
     * Ensure `value` and `languageCode` are always non-null to match the GraphQL schema.
     * Without this, a missing translation for the requested ctx.languageCode can make
     * list/detail queries fail (since `value: String!`).
     */
    private translateWithValueFallback(
        attribute: ProductVariantAttribute,
        ctx: RequestContext,
    ): Translated<ProductVariantAttribute> {
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

        return translated as Translated<ProductVariantAttribute>;
    }

    async findAll(ctx: RequestContext, options?: ListQueryOptions<ProductVariantAttribute>): Promise<PaginatedList<Translated<ProductVariantAttribute>>> {
        const query = this.listQueryBuilder.build(ProductVariantAttribute, options, {
            ctx,
            relations: ["attributeProperty"],
        })
        return query.getManyAndCount().then(async ([attributes, totalItems]) => {
            const items = attributes.map((attribute) => {
                const translatedAttribute = this.translateWithValueFallback(attribute, ctx)

                if (attribute.attributeProperty) {
                    translatedAttribute.attributeProperty = this.translator.translate(attribute.attributeProperty, ctx)
                }

                return translatedAttribute
            })
            return {
                items,
                totalItems,
            }
        })
    }

    async findOneByProductVariantIdAndCode(ctx: RequestContext, productVariantId: ID, code: string): Promise<Translated<ProductVariantAttribute> | undefined> {
        const attribute = await this.connection.getRepository(ctx, ProductVariantAttribute).findOne({
            where: {
                productVariantId: productVariantId,
                attributeProperty: {
                    code: code,
                },
            },
        })
        if (!attribute) {
            return
        }
        return this.translateWithValueFallback(attribute, ctx)
    }

    async findOneByProductVariantIdAndId(ctx: RequestContext, productVariantId: ID, id: ID): Promise<Translated<ProductVariantAttribute> | undefined> {
        const attribute = await this.connection.getRepository(ctx, ProductVariantAttribute).findOne({
            where: {
                productVariantId: productVariantId,
                id: id,
            },
        })
        if (!attribute) {
            return
        }
        return this.translateWithValueFallback(attribute, ctx)
    }

    async findOneById(ctx: RequestContext, id: ID): Promise<Translated<ProductVariantAttribute> | undefined> {
        const attribute = await this.connection.getRepository(ctx, ProductVariantAttribute).findOne({
            where: {
                id: id,
            },
        })

        if (!attribute) {
            return
        }

        return this.translateWithValueFallback(attribute, ctx)
    }

    async create(ctx: RequestContext, input: CreateProductVariantAttributeInput): Promise<Translated<ProductVariantAttribute>> {
        if (!input.translations || input.translations.some((t) => !t.languageCode)) {
            throw new Error("Each translation must have a languageCode")
        }
        const attribute = await this.translatableSaver.create({
            ctx,
            input,
            entityType: ProductVariantAttribute,
            translationType: ProductVariantAttributeTranslation,
        })

        return assertFound(this.findOneByProductVariantIdAndId(ctx, attribute.productVariantId, attribute.id))
    }

    async update(ctx: RequestContext, input: UpdateProductVariantAttributeInput & { id: ID }): Promise<Translated<ProductVariantAttribute>> {
        const updatedAttribute = await this.translatableSaver.update({
            ctx,
            input,
            entityType: ProductVariantAttribute,
            translationType: ProductVariantAttributeTranslation,
        })

        return assertFound(this.findOneById(ctx, updatedAttribute.id))
    }

    async delete(ctx: RequestContext, attributeId: ID): Promise<DeletionResponse> {
        const attribute = await this.connection.getEntityOrThrow(ctx, ProductVariantAttribute, attributeId, {
            relationLoadStrategy: "query",
            loadEagerRelations: false,
        })

        await this.connection.getRepository(ctx, ProductVariantAttribute).delete(attributeId)

        return {
            result: DeletionResult.DELETED,
        }
    }
}