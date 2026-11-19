import { Mutation, Query, Resolver } from "@nestjs/graphql"
import { Permission } from "@vendure/common/lib/generated-shop-types"
import { Allow, Ctx, RequestContext, Transaction } from "@vendure/core"
import { CustomerSepaService, SavedSepaMandate } from "./customer-sepa.service"

/**
 * Neither operation accepts a customer id — the mandate is always resolved from the session. That
 * is the whole ownership story: there is no id for a client to tamper with.
 */
@Resolver()
export class CustomerSepaShopResolver {
    constructor(private customerSepaService: CustomerSepaService) {}

    @Query()
    @Allow(Permission.Owner)
    async activeCustomerSepaMandate(@Ctx() ctx: RequestContext): Promise<SavedSepaMandate | null> {
        const customer = await this.customerSepaService.getOwnedCustomer(ctx)
        if (!customer) return null
        return this.customerSepaService.getSavedMandate(customer)
    }

    @Transaction()
    @Mutation()
    @Allow(Permission.Owner)
    async deleteActiveCustomerSepaMandate(@Ctx() ctx: RequestContext): Promise<boolean> {
        const customer = await this.customerSepaService.getOwnedCustomer(ctx)
        if (!customer) return false
        return this.customerSepaService.deleteMandate(ctx, customer.id)
    }
}
