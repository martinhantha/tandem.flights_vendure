import { Allow, Ctx, Logger, PaginatedList, RequestContext, Transaction } from "@vendure/core"
import { Args, Mutation, Query, Resolver } from "@nestjs/graphql"
import { VoucherService } from "./service"
import { Voucher } from "./entity"
import { voucherPermission } from "./permission"
import { DeletionResponse } from "@vendure/common/lib/generated-types"
import { loggerCtx } from "../../constants"

@Resolver()
export class VoucherShopResolver {
    constructor(private voucherService: VoucherService) {}

    @Query()
    @Allow(voucherPermission.Read)
    async vouchers(@Ctx() ctx: RequestContext, @Args() args: any): Promise<PaginatedList<Voucher>> {
        return this.voucherService.findAll(ctx, args.options || undefined)
    }
    
    @Query()
    @Allow(voucherPermission.Read)
    async ckeckAndCreateVoucherPdf(@Ctx() ctx: RequestContext, @Args() args: any): Promise<boolean> {
        return this.voucherService.ckeckAndCreateVoucherPdf(ctx, args.id || undefined)
    }

    @Query()
    async findCodesByCustomer(@Ctx() ctx: RequestContext): Promise<Voucher[] | null> {
        return this.voucherService.findCodesByCustomer(ctx)
    }

    @Transaction()
    @Mutation()
    @Allow(voucherPermission.Update)
    async useVoucher(@Ctx() ctx: RequestContext, @Args() args: any): Promise<Voucher> {
        return this.voucherService.useVoucher(ctx, args.id || undefined, args.amount || undefined)
    }

    @Transaction()
    @Mutation()
    @Allow(voucherPermission.Create)
    async createVoucher(@Ctx() ctx: RequestContext, @Args() args: any): Promise<Voucher> {
        return this.voucherService.createVoucher(ctx, args.input || undefined)
    }

    @Transaction()
    @Mutation()
    @Allow(voucherPermission.Update)
    async updateVoucher(@Ctx() ctx: RequestContext, @Args() args: any): Promise<Voucher> {
        return this.voucherService.updateVoucher(ctx, args.input || undefined)
    }

    @Transaction()
    @Mutation()
    @Allow(voucherPermission.Delete)
        async deleteVoucher(@Ctx() ctx: RequestContext, @Args() args: any): Promise<DeletionResponse> {
        return this.voucherService.deleteVoucher(ctx, args.id || undefined)
    }

    @Query()
    @Allow(voucherPermission.Read)
    async voucher(@Ctx() ctx: RequestContext, @Args() args: any): Promise<Voucher> {
        const voucher = await this.voucherService.findOne(ctx, args.id || undefined)
        if (!voucher) throw new Error("Voucher not found")
        return voucher
    }
}
