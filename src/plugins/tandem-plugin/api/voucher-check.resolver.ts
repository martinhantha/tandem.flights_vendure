import { Args, Query, Resolver } from "@nestjs/graphql"
import { Ctx, RequestContext } from "@vendure/core"
import { GraphQLError } from "graphql"
import { FixedWindowRateLimiter } from "../voucher-check/rate-limiter"
import { VoucherCheckResult, VoucherCheckService } from "../voucher-check/voucher-check.service"

const limit = parseInt(process.env.CHECK_VOUCHER_RATE_LIMIT ?? "", 10) || 20
const limiter = new FixedWindowRateLimiter(limit, 60 * 1000)

@Resolver()
export class VoucherCheckShopResolver {
    constructor(private voucherCheckService: VoucherCheckService) {}

    @Query()
    async checkVoucher(@Ctx() ctx: RequestContext, @Args() args: { code: string }): Promise<VoucherCheckResult> {
        // "trust proxy" is enabled in vendure-config, so req.ip is the client address behind the proxy
        const clientIp = ctx.req?.ip ?? "unknown"
        if (!limiter.take(clientIp)) {
            throw new GraphQLError("Too many voucher checks, please try again in a minute.", {
                extensions: { code: "TOO_MANY_REQUESTS" },
            })
        }
        return this.voucherCheckService.check(ctx, args.code)
    }
}
