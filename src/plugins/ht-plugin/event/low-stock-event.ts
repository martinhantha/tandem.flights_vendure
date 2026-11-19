import { ProductVariant, RequestContext, VendureEvent } from "@vendure/core"

/**
 * `low-stock`     the saleable stock dropped to or below the configured threshold
 * `out-of-stock`  the saleable stock dropped to 0 - reported independently of the threshold,
 *                 so it still arrives when no threshold is configured or the low stock mail
 *                 was missed
 */
export type LowStockReason = "low-stock" | "out-of-stock"

/**
 * When stock level is below threshold, sending 1 mail
 * when stock again above treshhold reset it to get a mail again when below
 */
export class LowStockEvent extends VendureEvent {
    constructor(
        public ctx: RequestContext,
        public variant: ProductVariant,
        public stockOnHand: number,
        public stockAllocated: number,
        public threshold: number,
        public reason: LowStockReason = "low-stock",
    ) {
        super()
    }
}
