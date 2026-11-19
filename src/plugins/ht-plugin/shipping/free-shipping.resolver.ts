import { Args, Query, Resolver } from "@nestjs/graphql"
import { ActiveOrderService, Country, CountryService, Ctx, EntityHydrator, Order, RequestContext, ShippingMethod, ShippingMethodService, Translated } from "@vendure/core"
import { parseShippingConfig } from "./shipping-config"

// shop api only type, src/gql/generated.ts is generated from the admin api
type FreeShippingInfo = {
    threshold: number
    remaining: number
    qualified: boolean
    country: Translated<Country> | null
}

type ThresholdResolver = (method: ShippingMethod, countryCode: string | null) => number | null

// mirrors the free shipping logic of the calculators in this folder
const thresholdResolvers: Record<string, ThresholdResolver> = {
    "country-based-calculator": (method, countryCode) => {
        const arg = method.calculator?.args?.find((a) => a.name === "shippingConfig")
        if (!arg) return null
        const cfg = parseShippingConfig(arg.value)
        const country = countryCode ? cfg.countries.find((c) => c.code.toUpperCase() === countryCode) : undefined
        const threshold = country?.freeShipping ?? cfg.defaultFreeShipping
        return threshold > 0 ? threshold : null
    },
    "flat-rate-calculator": (method) => {
        const arg = method.calculator?.args?.find((a) => a.name === "freeShippingFrom")
        if (!arg) return null
        const n = parseInt(String(arg.value ?? ""), 10)
        return Number.isFinite(n) && n > 0 ? n : null
    },
}

@Resolver()
export class FreeShippingResolver {
    constructor(private activeOrderService: ActiveOrderService, private shippingMethodService: ShippingMethodService, private countryService: CountryService, private entityHydrator: EntityHydrator) {}

    @Query()
    async freeShippingInfo(@Ctx() ctx: RequestContext, @Args() args: { countryCode?: string | null }): Promise<FreeShippingInfo> {
        const order = ctx.session ? await this.activeOrderService.getActiveOrder(ctx, undefined) : undefined
        if (order) {
            await this.entityHydrator.hydrate(ctx, order, { relations: ["shippingLines"] })
        }
        const argCountryCode = args?.countryCode ? args.countryCode.toUpperCase() : null
        const orderCountryCode = order?.shippingAddress?.countryCode ? order.shippingAddress.countryCode.toUpperCase() : null
        const countryCode = argCountryCode ?? orderCountryCode
        const country = await this.resolveCountry(ctx, countryCode)

        const method = await this.resolveShippingMethod(ctx, order)
        const resolver = method ? thresholdResolvers[method.calculator?.code ?? ""] : undefined
        const threshold = method && resolver ? resolver(method, countryCode) : null

        if (!threshold) {
            return { threshold: 0, remaining: 0, qualified: false, country }
        }

        const subTotal = order?.subTotalWithTax ?? 0
        const remaining = Math.max(0, threshold - subTotal)
        return { threshold, remaining, qualified: remaining === 0, country }
    }

    // the method already chosen on the order, otherwise the first one (by sorting) with a known calculator
    private async resolveShippingMethod(ctx: RequestContext, order: Order | undefined): Promise<ShippingMethod | null> {
        const methods = await this.shippingMethodService.getActiveShippingMethods(ctx)
        const selectedId = order?.shippingLines?.[0]?.shippingMethodId
        if (selectedId != null) {
            const found = methods.find((m) => String(m.id) === String(selectedId))
            if (found) return found
        }
        const sorted = [...methods].sort((a, b) => (a.customFields?.sorting ?? 0) - (b.customFields?.sorting ?? 0))
        return sorted.find((m) => thresholdResolvers[m.calculator?.code ?? ""]) ?? null
    }

    private async resolveCountry(ctx: RequestContext, code: string | null): Promise<Translated<Country> | null> {
        if (!code) return null
        try {
            return await this.countryService.findOneByCode(ctx, code)
        } catch {
            return null
        }
    }
}
