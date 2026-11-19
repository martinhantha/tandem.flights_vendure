import { ListQueryBuilder, ListQueryOptions, PaginatedList, RequestContext, TransactionalConnection, ID, Translated, TranslatorService, TranslatableSaver, assertFound, EventBus, idsAreEqual } from "@vendure/core"
import { Injectable } from "@nestjs/common"
import { IsNull } from "typeorm"

import { Textblock } from "./entity"
import { TextblockTranslation } from "./translation.entity"
import { TextblockEvent } from "./event"
import { CreateTextblockInput, UpdateTextblockInput } from "src/gql/generated"
import { DeletionResponse, DeletionResult } from "@vendure/common/lib/generated-types"

@Injectable()
export class TextblockService {
    constructor(private connection: TransactionalConnection, private listQueryBuilder: ListQueryBuilder, private translatableSaver: TranslatableSaver, private translator: TranslatorService, private eventBus: EventBus) {}

    async findAll(ctx: RequestContext, options?: ListQueryOptions<Textblock>): Promise<PaginatedList<Translated<Textblock>>> {
        const query = this.listQueryBuilder.build(Textblock, options, {
            where: { deletedAt: IsNull() },
            ctx,
        })
        return query.getManyAndCount().then(async ([textblocks, totalItems]) => {
            const items = textblocks.map((textblock) => this.translator.translate(textblock, ctx))
            return {
                items,
                totalItems,
            }
        })
    }

    async findOne(ctx: RequestContext, id: ID): Promise<Translated<Textblock> | undefined> {
        const textblock = await this.connection.getRepository(ctx, Textblock).findOne({
            where: {
                id,
                deletedAt: IsNull(),
            },
        })
        if (!textblock) {
            return
        }
        return this.translator.translate(textblock, ctx)
    }

    async getText(ctx: RequestContext, name: string, langCode?: string): Promise<string> {
        const textblock = await this.connection.getRepository(ctx, Textblock).findOne({
            where: {
                name,
                enabled: true,
                deletedAt: IsNull(),
            },
        })
        if (!textblock) {
            return ""
        }
        const languageCode = langCode ? langCode : ctx.languageCode
        return textblock.translations.find((t) => t.languageCode === languageCode)?.description ?? ""
    }

    async create(ctx: RequestContext, input: CreateTextblockInput): Promise<Translated<Textblock>> {
        normalizeTranslationDescriptions(input)
        const textblock = await this.translatableSaver.create({
            ctx,
            input,
            entityType: Textblock,
            translationType: TextblockTranslation,
            beforeSave: async (t) => {
                t.name = await this.ensureUniqueName(ctx, t.name)
            },
        })

        await this.eventBus.publish(new TextblockEvent(ctx, textblock, "created", input))
        return assertFound(this.findOne(ctx, textblock.id))
    }

    async update(ctx: RequestContext, input: UpdateTextblockInput) {
        normalizeTranslationDescriptions(input)
        const updatedTextblock = await this.translatableSaver.update({
            ctx,
            input,
            entityType: Textblock,
            translationType: TextblockTranslation,
            beforeSave: async (t) => {
                t.name = await this.ensureUniqueName(ctx, t.name, t.id)
            },
        })
        await this.eventBus.publish(new TextblockEvent(ctx, updatedTextblock, "updated", input))
        return assertFound(this.findOne(ctx, updatedTextblock.id))
    }

    async softDelete(ctx: RequestContext, textblockId: ID): Promise<DeletionResponse> {
        const textblock = await this.connection.getEntityOrThrow(ctx, Textblock, textblockId, {
            relationLoadStrategy: "query",
            loadEagerRelations: false,
        })
        textblock.deletedAt = new Date()
        await this.connection.getRepository(ctx, Textblock).save(textblock, { reload: false })
        await this.eventBus.publish(new TextblockEvent(ctx, textblock, "deleted", textblockId))
        return {
            result: DeletionResult.DELETED,
        }
    }

    /**
     * Checks to ensure the Textblock name is unique. If there is a conflict, then the name is suffixed
     * with an incrementing integer.
     */
    private async ensureUniqueName(ctx: RequestContext, name: string, id?: ID) {
        let candidate = name
        let suffix = 1
        let conflict = false
        const alreadySuffixed = /-\d+$/
        do {
            const match = await this.connection.getRepository(ctx, Textblock).findOne({
                where: {
                    name: candidate,
                    deletedAt: IsNull(),
                },
            })

            conflict = !!match && ((id != null && !idsAreEqual(match.id, id)) || id == null)
            if (conflict) {
                suffix++
                if (alreadySuffixed.test(candidate)) {
                    candidate = candidate.replace(alreadySuffixed, `-${suffix}`)
                } else {
                    candidate = `${candidate}-${suffix}`
                }
            }
        } while (conflict)

        return candidate
    }
}

function normalizeTranslationDescriptions(input: CreateTextblockInput | UpdateTextblockInput) {
    for (const t of input.translations ?? []) {
        if (typeof t?.description === "string") {
            t.description = t.description.normalize("NFC")
        }
    }
}