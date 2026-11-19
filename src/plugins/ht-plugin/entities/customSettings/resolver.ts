import { Allow, Ctx, ID, RequestContext, Transaction } from "@vendure/core"
import { Args, Query, Resolver, Mutation } from "@nestjs/graphql"

import { CustomSettingsService } from "./service"
import { CustomSettings } from "./entity"
import { customSettingsPermission } from "./permission"
import { MutationCreateCustomSettingsArgs, MutationDeleteCustomSettingsArgs, MutationUpdateCustomSettingsArgs } from "src/gql/generated"
import { DeletionResponse } from "@vendure/common/lib/generated-types"

@Resolver()
export class CustomSettingsAdminResolver {
    constructor(private customSettingsService: CustomSettingsService) {}

    @Query()
    @Allow(customSettingsPermission.Read)
    async customSettings(@Ctx() ctx: RequestContext, @Args("id") id?: ID, @Args("name") name?: string): Promise<CustomSettings | null> {
        return this.customSettingsService.findOne(ctx, { id, name })
    }
    @Transaction()
    @Mutation()
    @Allow(customSettingsPermission.Create)
    async createCustomSettings(@Ctx() ctx: RequestContext, @Args() args: MutationCreateCustomSettingsArgs): Promise<CustomSettings> {
        const { input } = args
        return this.customSettingsService.create(ctx, input)
    }
    @Transaction()
    @Mutation()
    @Allow(customSettingsPermission.Update)
    async updateCustomSettings(@Ctx() ctx: RequestContext, @Args() args: MutationUpdateCustomSettingsArgs): Promise<CustomSettings> {
        const { input } = args
        return await this.customSettingsService.update(ctx, input)
    }

    @Transaction()
    @Mutation()
    @Allow(customSettingsPermission.Delete)
    async deleteCustomSettings(@Ctx() ctx: RequestContext, @Args() args: MutationDeleteCustomSettingsArgs): Promise<DeletionResponse> {
        return this.customSettingsService.softDelete(ctx, args.id)
    }
}
