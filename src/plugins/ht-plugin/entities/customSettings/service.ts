import { assertFound, ID, ListQueryBuilder, ListQueryOptions, PaginatedList, RequestContext, TransactionalConnection, Type, UserInputError } from "@vendure/core"
import { Injectable, Logger } from "@nestjs/common"
import { IsNull } from "typeorm"

import { CustomSettings } from "./entity"
import { CreateCustomSettingsInput, UpdateCustomSettingsInput } from "src/gql/generated"
import { DeletionResponse, DeletionResult } from "@vendure/common/lib/generated-types"
import { getFontsData } from "../../helper/pdf-helper"

@Injectable()
export class CustomSettingsService {
    constructor(
        private connection: TransactionalConnection,
        private listQueryBuilder: ListQueryBuilder
    ) {}

    async findAll(ctx: RequestContext, options?: ListQueryOptions<CustomSettings>): Promise<PaginatedList<CustomSettings>> {
        const query = this.listQueryBuilder.build(CustomSettings as Type<CustomSettings>, options, {
            where: { deletedAt: IsNull() },
            ctx,
        })
        return query.getManyAndCount().then(async ([customSettings, totalItems]) => {
            return {
                items: customSettings,
                totalItems,
            }
        })
    }

    async findOne(ctx: RequestContext, input: { id?: ID; name?: string }): Promise<CustomSettings | null> {
        const repo = this.connection.getRepository(ctx, CustomSettings)

        if (input.id != null) {
            return repo.findOne({ where: { id: input.id, deletedAt: IsNull() } })
        }
        if (input.name != null) {
            return repo.findOne({ where: { name: input.name, deletedAt: IsNull() } })
        }
        return null
    }
    async create(ctx: RequestContext, input: CreateCustomSettingsInput): Promise<CustomSettings> {
        if (input.name == null || input.name.trim() === "") {
            throw new UserInputError("CustomSettings.name is required")
        }
        if (input.value == null) {
            throw new UserInputError("CustomSettings.value is required")
        }

        const repo = this.connection.getRepository(ctx, CustomSettings)
        let value = JSON.parse(input.value)
        value.options.font = await getFontsData()

        const customSettings = repo.create({
            name: input.name,
            value: JSON.stringify(value),
        })
        await repo.save(customSettings)
        return customSettings
    }

    async update(ctx: RequestContext, input: UpdateCustomSettingsInput) {
        const repo = this.connection.getRepository(ctx, CustomSettings)

        const patch: Partial<CustomSettings> = {}
        if (input.name != null) {
            patch.name = input.name
        }
        if (input.value != null) {
            let value = JSON.parse(input.value)
            value.options = value.options || {}
            value.options.font = await getFontsData()
            patch.value = JSON.stringify(value)
        }
        // get size of value
        const size = JSON.stringify(patch.value).length
        Logger.debug("update customSettings size: " + size, "CustomSettingsService")
        if (size > 1000000) {
            throw new UserInputError("CustomSettings.value is too large")
        }
        await repo.update(input.id, patch)
        return assertFound(repo.findOne({ where: { id: input.id } }))
    }

    async softDelete(ctx: RequestContext, customSettingsId: ID): Promise<DeletionResponse> {
        const customSettings = await this.connection.getEntityOrThrow(ctx, CustomSettings, customSettingsId, {
            relationLoadStrategy: "query",
            loadEagerRelations: false,
        })
        customSettings.deletedAt = new Date()
        await this.connection.getRepository(ctx, CustomSettings).save(customSettings, { reload: false })
        return {
            result: DeletionResult.DELETED,
        }
    }
}
