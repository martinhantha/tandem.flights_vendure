import { Injector, Order, Product, RequestContext, RequestContextCacheService, TransactionalConnection } from "@vendure/core"
import { In } from "typeorm"

let connection: TransactionalConnection
let requestCache: RequestContextCacheService

export function initOrderHasPhysicalProduct(injector: Injector) {
    connection = injector.get(TransactionalConnection)
    requestCache = injector.get(RequestContextCacheService)
}

/**
 * Reads `isDigital` from the products instead of hydrating the order: eligibility checks run in the
 * middle of OrderCalculator.applyPriceAdjustments(), and hydrate() would merge the persisted order lines
 * over the unsaved prices, taxes and promotion adjustments.
 */
export async function orderHasPhysicalProduct(ctx: RequestContext, order: Order): Promise<boolean> {
    const productIds = [...new Set(order.lines.map((line) => line.productVariant.productId))]
    if (!productIds.length) return false

    // Cached per request, so both shipping checkers and repeated checks share one query
    const digitalCount = await requestCache.get(ctx, `orderHasPhysicalProduct:${[...productIds].sort().join(",")}`, () =>
        connection.getRepository(ctx, Product).count({ where: { id: In(productIds), customFields: { isDigital: true } } }),
    )

    return digitalCount < productIds.length
}
