import { Mutation, Resolver } from "@nestjs/graphql"
import { Permission } from "@vendure/common/lib/generated-shop-types"
import { Allow, Ctx, EventBus, LanguageCode, Logger, OrderService, RequestContext } from "@vendure/core"
import { AssetCacheMaintenanceService } from "../../services/asset-cache-maintenance.service"
import { CollectionMenuRedisCacheService } from "../../services/collection-menu-redis-cache.service"

type RefreshImageCacheResult = {
    success: boolean
    message: string
    deletedCount: number
}

type RegenerateAssetPreviewsResult = {
    success: boolean
    message: string
    regeneratedCount: number
    failedCount: number
}

type NormalizeAssetSourcesResult = {
    success: boolean
    message: string
    normalizedCount: number
    skippedCount: number
    failedCount: number
}

type ClearCollectionMenuCacheResult = {
    success: boolean
    message: string
    deletedKeys: number
}

@Resolver()
export class ToolsAdminResolver {
    constructor(
        private orderService: OrderService,
        private eventBus: EventBus,
        private assetCacheMaintenance: AssetCacheMaintenanceService,
        private collectionMenuRedisCache: CollectionMenuRedisCacheService,
    ) {}

    @Mutation()
    @Allow(Permission.UpdateCatalog, Permission.SuperAdmin)
    async refreshImageCache(@Ctx() ctx: RequestContext): Promise<RefreshImageCacheResult> {
        try {
            const { deletedCount, message } = await this.assetCacheMaintenance.clearTransformCache(ctx)
            return {
                success: true,
                message,
                deletedCount,
            }
        } catch (error: any) {
            Logger.error(`refreshImageCache failed: ${error?.message ?? error}`, "ToolsAdminResolver")
            return {
                success: false,
                message: error?.message ?? "Failed to refresh image cache",
                deletedCount: 0,
            }
        }
    }

    @Mutation()
    @Allow(Permission.UpdateCatalog, Permission.SuperAdmin)
    async clearCollectionMenuCache(@Ctx() _ctx: RequestContext): Promise<ClearCollectionMenuCacheResult> {
        try {
            if (!this.collectionMenuRedisCache.isEnabled()) {
                return {
                    success: true,
                    message: "Collection menu Redis is disabled (COLLECTION_MENU_REDIS_DISABLED=1); nothing to clear.",
                    deletedKeys: 0,
                }
            }
            const deletedKeys = await this.collectionMenuRedisCache.deleteByPrefix()
            return {
                success: true,
                message: `Deleted ${deletedKeys} key(s) matching prefix ${CollectionMenuRedisCacheService.KEY_PREFIX}`,
                deletedKeys,
            }
        } catch (error: any) {
            Logger.error(`clearCollectionMenuCache failed: ${error?.message ?? error}`, "ToolsAdminResolver")
            return {
                success: false,
                message: error?.message ?? "Failed to clear collection menu cache",
                deletedKeys: 0,
            }
        }
    }

    @Mutation()
    @Allow(Permission.UpdateCatalog, Permission.SuperAdmin)
    async regenerateAssetPreviews(@Ctx() ctx: RequestContext): Promise<RegenerateAssetPreviewsResult> {
        try {
            const { regeneratedCount, failedCount } = await this.assetCacheMaintenance.regenerateAllPreviewFiles(ctx)
            return {
                success: true,
                message: "Preview files rewritten from source (upload-time previews under preview/)",
                regeneratedCount,
                failedCount,
            }
        } catch (error: any) {
            Logger.error(`regenerateAssetPreviews failed: ${error?.message ?? error}`, "ToolsAdminResolver")
            return {
                success: false,
                message: error?.message ?? "Failed to regenerate asset previews",
                regeneratedCount: 0,
                failedCount: 0,
            }
        }
    }

    @Mutation()
    @Allow(Permission.UpdateCatalog, Permission.SuperAdmin)
    async normalizeAssetSources(@Ctx() ctx: RequestContext): Promise<NormalizeAssetSourcesResult> {
        try {
            const { normalizedCount, skippedCount, failedCount } = await this.assetCacheMaintenance.normalizeAllImageSources(ctx)
            return {
                success: true,
                message: "Image sources normalized (EXIF orientation applied and dimensions updated)",
                normalizedCount,
                skippedCount,
                failedCount,
            }
        } catch (error: any) {
            Logger.error(`normalizeAssetSources failed: ${error?.message ?? error}`, "ToolsAdminResolver")
            return {
                success: false,
                message: error?.message ?? "Failed to normalize asset sources",
                normalizedCount: 0,
                skippedCount: 0,
                failedCount: 0,
            }
        }
    }
}
