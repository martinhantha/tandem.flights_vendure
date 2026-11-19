import { Ctx, PaginatedList, Permission, RequestContext, Allow, Transaction, Translated, UserInputError } from "@vendure/core"
import { Args, Query, Resolver, Mutation } from "@nestjs/graphql"

import { Textblock } from "./entity"
import { TextblockService } from "./service"
import { QueryTextblockArgs, MutationCreateTextblockArgs, MutationUpdateTextblockArgs, MutationUpdateTextblocksArgs, MutationDeleteTextblockArgs, MutationDeleteTextblocksArgs } from "src/gql/generated"
import { DeletionResponse } from "@vendure/common/lib/generated-types"
import { textblockPermission } from "./permission"

@Resolver()
export class TextblockAdminResolver {
    constructor(private textblockService: TextblockService) {}

    @Query()
    async textblocks(@Ctx() ctx: RequestContext, @Args() args: any): Promise<PaginatedList<Translated<Textblock>>> {
        return this.textblockService.findAll(ctx, args.options || undefined)
    }

    @Query()
    @Allow(textblockPermission.Read)
    async textblock(@Ctx() ctx: RequestContext, @Args() args: QueryTextblockArgs): Promise<Translated<Textblock> | undefined> {
        if (args.id) {
            return this.textblockService.findOne(ctx, args.id)
        } else {
            throw new UserInputError("error.textblock-id-must-be-provided")
        }
    }

    @Transaction()
    @Mutation()
    @Allow(textblockPermission.Create)
    async createTextblock(@Ctx() ctx: RequestContext, @Args() args: MutationCreateTextblockArgs): Promise<Translated<Textblock>> {
        const { input } = args
        return this.textblockService.create(ctx, input)
    }

    @Transaction()
    @Mutation()
    @Allow(textblockPermission.Update)
    async updateTextblock(@Ctx() ctx: RequestContext, @Args() args: MutationUpdateTextblockArgs): Promise<Translated<Textblock>> {
        const { input } = args
        return await this.textblockService.update(ctx, input)
    }

    @Transaction()
    @Mutation()
    @Allow(textblockPermission.Update)
    async updateTextblocks(@Ctx() ctx: RequestContext, @Args() args: MutationUpdateTextblocksArgs): Promise<Array<Translated<Textblock>>> {
        const { input } = args
        return await Promise.all(args.input.map((i) => this.textblockService.update(ctx, i)))
    }

    @Transaction()
    @Mutation()
    @Allow(textblockPermission.Delete)
    async deleteTextblock(@Ctx() ctx: RequestContext, @Args() args: MutationDeleteTextblockArgs): Promise<DeletionResponse> {
        return this.textblockService.softDelete(ctx, args.id)
    }

    @Transaction()
    @Mutation()
    @Allow(textblockPermission.Delete)
    async deleteTextblocks(@Ctx() ctx: RequestContext, @Args() args: MutationDeleteTextblocksArgs): Promise<DeletionResponse[]> {
        return Promise.all(args.ids.map((id) => this.textblockService.softDelete(ctx, id)))
    }
}
