import { Injectable } from "@nestjs/common"
import { GlobalFlag, StockMovementType } from "@vendure/common/lib/generated-types"
import { EventBus, GlobalSettingsService, ID, Logger, ProductVariantService, RequestContext, StockLevelService, StockMovement } from "@vendure/core"
import { loggerCtx } from "../constants"
import { LowStockEvent } from "../event/low-stock-event"

/**
 * Effect of a single stock movement on the *saleable* stock (stockOnHand - stockAllocated),
 * derived from how `StockMovementService` writes the stock levels:
 *
 *   ADJUSTMENT    quantity = delta -> stockOnHand += q                        => saleable += q
 *   CANCELLATION  quantity = +q    -> stockOnHand += q                        => saleable += q
 *   RELEASE       quantity = +q    -> stockAllocated -= q                     => saleable += q
 *   ALLOCATION    quantity = +q    -> stockAllocated += q                     => saleable -= q
 *   SALE          quantity = -q    -> stockOnHand -= q, stockAllocated -= q   => saleable unchanged
 *
 * A SALE only converts an existing allocation, so it never lowers the saleable stock and
 * can never be the moment the threshold is crossed - the ALLOCATION before it was.
 */
function saleableStockDelta(movement: StockMovement): number {
    switch (movement.type) {
        case StockMovementType.ADJUSTMENT:
        case StockMovementType.CANCELLATION:
        case StockMovementType.RELEASE:
        case StockMovementType.RETURN:
            return movement.quantity
        case StockMovementType.ALLOCATION:
            return -movement.quantity
        default:
            return 0
    }
}

/**
 * Sends a single alert mail at the moment a ProductVariant's saleable stock *drops to or below*
 * its threshold. Deliberately stateless: the previous stock level is reconstructed from the
 * movement deltas, so no mail is repeated for every further sale below the threshold, and the
 * alert re-arms by itself once stock is replenished above it. Works identically in the server
 * and worker process and survives restarts.
 */
@Injectable()
export class LowStockService {
    constructor(
        private eventBus: EventBus,
        private globalSettingsService: GlobalSettingsService,
        private productVariantService: ProductVariantService,
        private stockLevelService: StockLevelService,
    ) {}

    async checkStockMovements(ctx: RequestContext, movements: StockMovement[]): Promise<void> {
        const settings = await this.globalSettingsService.getSettings(ctx)
        const recipient = settings.customFields?.lowStockEmailTo?.trim()
        if (!recipient) return

        const globalThreshold = settings.customFields?.lowStockThreshold ?? 0

        const deltaByVariant = new Map<ID, number>()
        for (const movement of movements) {
            const variantId = movement.productVariant?.id
            if (variantId == null) continue
            deltaByVariant.set(variantId, (deltaByVariant.get(variantId) ?? 0) + saleableStockDelta(movement))
        }

        for (const [variantId, delta] of deltaByVariant) {
            // a movement that did not lower the saleable stock cannot have crossed the threshold
            if (delta >= 0) continue
            try {
                await this.checkVariant(ctx, variantId, delta, globalThreshold, settings.trackInventory)
            } catch (error) {
                Logger.error(`Low stock check failed for variant ${variantId}: ${(error as Error)?.message}`, loggerCtx)
            }
        }
    }

    private async checkVariant(ctx: RequestContext, variantId: ID, delta: number, globalThreshold: number, globalTrackInventory: boolean): Promise<void> {
        const variant = await this.productVariantService.findOne(ctx, variantId)
        if (!variant) return

        // for variants that do not track inventory the movement leaves the stock levels untouched, which would make the reconstructed previous level wrong
        const tracksInventory = variant.trackInventory === GlobalFlag.TRUE || (variant.trackInventory === GlobalFlag.INHERIT && globalTrackInventory)
        if (!tracksInventory) return

        const threshold = variant.customFields?.lowStockThreshold ?? globalThreshold

        const { stockOnHand, stockAllocated } = await this.stockLevelService.getAvailableStock(ctx, variantId)
        const saleable = stockOnHand - stockAllocated
        const previousSaleable = saleable - delta

        // Safty: if out-of-stock (forgot to set the stock level or didnt see the mail low-stock)
        if (saleable <= 0 && previousSaleable > 0) {
            Logger.info(`Out of stock alert for ${variant.sku}`, loggerCtx)
            await this.eventBus.publish(new LowStockEvent(ctx, variant, stockOnHand, stockAllocated, threshold, "out-of-stock"))
            return
        }

        if (threshold <= 0) return

        // only the crossing itself triggers a mail, not every further movement below the threshold
        if (saleable > threshold || previousSaleable <= threshold) return

        Logger.info(`Low stock alert for ${variant.sku}: ${saleable} saleable left (threshold ${threshold})`, loggerCtx)
        await this.eventBus.publish(new LowStockEvent(ctx, variant, stockOnHand, stockAllocated, threshold, "low-stock"))
    }
}
