import { Injectable } from "@nestjs/common"
import { promises as fs } from "fs"
import path from "path"
import { DeleteObjectsCommand, ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3"
import { Asset, AssetType, ConfigService, Logger, RequestContext, TransactionalConnection } from "@vendure/core"
import {
    getRasterImageDimensions,
    getRasterImageOrientation,
    isRasterImageFileName,
    normalizeRasterImageBuffer,
} from "../strategies/normalize-raster-image"

const loggerCtx = "AssetCacheMaintenance"

/**
 * Vendure AssetServerPlugin stores **on-the-fly transforms** (presets, w/h, format) under `cache/`
 * — see https://docs.vendure.io/reference/core-plugins/asset-server-plugin/ ("Caching").
 * Persisted upload previews live under `preview/` and are created at upload time; they are not
 * the same as the transform cache.
 */
@Injectable()
export class AssetCacheMaintenanceService {
    constructor(private connection: TransactionalConnection, private configService: ConfigService) {}

    /** Storage identifiers may be stored with a leading slash; local + S3 strategies expect relative keys. */
    normalizeStorageIdentifier(identifier: string | null | undefined): string {
        if (!identifier) {
            return ""
        }
        return identifier.replace(/^\/+/, "").trim()
    }

    /**
     * Deletes only transform cache entries (`cache/`). Safe to run anytime.
     * Does not remove `preview/` (upload-time previews required for Asset.preview URLs).
     */
    async clearTransformCache(ctx: RequestContext): Promise<{ deletedCount: number; message: string }> {
        const isLocal = process.env.APP_LOCAL === "true"
        if (isLocal) {
            const basePath = path.resolve(process.cwd(), "static/assets")
            const cachePath = path.join(basePath, "cache")
            const deletedCount = await this.clearLocalDirectoryEntries(cachePath)
            Logger.info(`clearTransformCache local: deleted ${deletedCount} entries, user=${ctx.activeUserId}`, loggerCtx)
            return {
                deletedCount,
                message: "Local transform cache cleared (cache/ only, per AssetServerPlugin)",
            }
        }
        const deletedCount = await this.clearS3Prefix("cache/")
        Logger.info(`clearTransformCache s3: deleted ${deletedCount} objects, user=${ctx.activeUserId}`, loggerCtx)
        return {
            deletedCount,
            message: "S3 transform cache cleared (cache/ prefix only)",
        }
    }

    /**
     * Re-writes each asset's preview file from its source using the configured AssetPreviewStrategy.
     * Use when `preview/` files were removed but DB rows and `source/` files still exist.
     */
    async regenerateAllPreviewFiles(ctx: RequestContext): Promise<{ regeneratedCount: number; failedCount: number }> {
        const { assetPreviewStrategy, assetStorageStrategy } = this.configService.assetOptions
        let regeneratedCount = 0
        let failedCount = 0
        const batchSize = 40
        let skip = 0

        while (true) {
            const assets = await this.connection
                .getRepository(ctx, Asset)
                .createQueryBuilder("asset")
                .orderBy("asset.id", "ASC")
                .skip(skip)
                .take(batchSize)
                .getMany()

            if (!assets.length) {
                break
            }

            for (const asset of assets) {
                const src = this.normalizeStorageIdentifier(asset.source)
                const prv = this.normalizeStorageIdentifier(asset.preview)
                if (!src || !prv) {
                    failedCount += 1
                    Logger.warn(`regenerate: missing source or preview path for asset id=${asset.id}`, loggerCtx)
                    continue
                }
                try {
                    const sourceBuffer = await assetStorageStrategy.readFileToBuffer(src)
                    if (!sourceBuffer?.length) {
                        throw new Error(`empty or missing source read for asset ${asset.id}`)
                    }
                    const previewBuffer = await assetPreviewStrategy.generatePreviewImage(ctx, asset.mimeType, sourceBuffer)
                    if (!previewBuffer?.length) {
                        throw new Error(`empty preview buffer for asset ${asset.id}`)
                    }
                    await assetStorageStrategy.writeFileFromBuffer(prv, previewBuffer)
                    regeneratedCount += 1
                } catch (e: any) {
                    failedCount += 1
                    Logger.error(
                        `regenerate preview failed for asset id=${asset.id}: ${e?.message ?? e}`,
                        loggerCtx,
                        e?.stack
                    )
                }
            }
            skip += batchSize
        }

        Logger.info(`regenerateAllPreviewFiles done: ok=${regeneratedCount}, failed=${failedCount}, user=${ctx.activeUserId}`, loggerCtx)
        return { regeneratedCount, failedCount }
    }

    /**
     * Rewrites image sources with EXIF orientation baked in, updates width/height/fileSize, regenerates previews.
     * Run once for assets uploaded before ExifNormalizingAssetStorageStrategy was enabled.
     */
    async normalizeAllImageSources(ctx: RequestContext): Promise<{
        normalizedCount: number
        skippedCount: number
        failedCount: number
    }> {
        const { assetPreviewStrategy, assetStorageStrategy } = this.configService.assetOptions
        let normalizedCount = 0
        let skippedCount = 0
        let failedCount = 0
        const batchSize = 40
        let skip = 0

        while (true) {
            const assets = await this.connection
                .getRepository(ctx, Asset)
                .createQueryBuilder("asset")
                .where("asset.type = :type", { type: AssetType.IMAGE })
                .orderBy("asset.id", "ASC")
                .skip(skip)
                .take(batchSize)
                .getMany()

            if (!assets.length) {
                break
            }

            for (const asset of assets) {
                const src = this.normalizeStorageIdentifier(asset.source)
                const prv = this.normalizeStorageIdentifier(asset.preview)
                if (!src || !prv || !isRasterImageFileName(src)) {
                    skippedCount += 1
                    continue
                }

                try {
                    const sourceBuffer = await assetStorageStrategy.readFileToBuffer(src)
                    if (!sourceBuffer?.length) {
                        throw new Error(`empty or missing source read for asset ${asset.id}`)
                    }

                    const orientation = await getRasterImageOrientation(sourceBuffer)
                    const normalizedBuffer = await normalizeRasterImageBuffer(sourceBuffer, src)
                    const { width, height } = await getRasterImageDimensions(normalizedBuffer)
                    const needsUpdate =
                        (orientation ?? 1) > 1 ||
                        asset.width !== width ||
                        asset.height !== height ||
                        asset.fileSize !== normalizedBuffer.byteLength

                    if (!needsUpdate) {
                        skippedCount += 1
                        continue
                    }

                    await assetStorageStrategy.writeFileFromBuffer(src, normalizedBuffer)

                    const previewBuffer = await assetPreviewStrategy.generatePreviewImage(ctx, asset.mimeType, normalizedBuffer)
                    if (!previewBuffer?.length) {
                        throw new Error(`empty preview buffer for asset ${asset.id}`)
                    }
                    await assetStorageStrategy.writeFileFromBuffer(prv, previewBuffer)

                    asset.width = width
                    asset.height = height
                    asset.fileSize = normalizedBuffer.byteLength
                    await this.connection.getRepository(ctx, Asset).save(asset)
                    normalizedCount += 1
                } catch (e: any) {
                    failedCount += 1
                    Logger.error(
                        `normalize source failed for asset id=${asset.id}: ${e?.message ?? e}`,
                        loggerCtx,
                        e?.stack,
                    )
                }
            }
            skip += batchSize
        }

        Logger.info(
            `normalizeAllImageSources done: ok=${normalizedCount}, skipped=${skippedCount}, failed=${failedCount}, user=${ctx.activeUserId}`,
            loggerCtx,
        )
        return { normalizedCount, skippedCount, failedCount }
    }

    private async clearLocalDirectoryEntries(dirPath: string): Promise<number> {
        try {
            const entries = await fs.readdir(dirPath, { withFileTypes: true })
            let deletedCount = 0
            for (const entry of entries) {
                const entryPath = path.join(dirPath, entry.name)
                await fs.rm(entryPath, { recursive: true, force: true })
                deletedCount += 1
            }
            return deletedCount
        } catch (error: any) {
            if (error?.code === "ENOENT") {
                return 0
            }
            throw error
        }
    }

    private createS3Client(): S3Client {
        return new S3Client({
            region: process.env.AWS_REGION,
            endpoint: process.env.AWS_ENDPOINT,
            credentials: {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
            },
            forcePathStyle: !!process.env.AWS_ENDPOINT,
        })
    }

    private async clearS3Prefix(prefix: string): Promise<number> {
        const bucket = process.env.AWS_BUCKET
        if (!bucket) {
            throw new Error("AWS_BUCKET is not configured")
        }
        const s3 = this.createS3Client()
        let continuationToken: string | undefined
        let deletedCount = 0

        do {
            const listed = await s3.send(
                new ListObjectsV2Command({
                    Bucket: bucket,
                    Prefix: prefix,
                    ContinuationToken: continuationToken,
                })
            )
            const objects = listed.Contents?.filter((obj) => !!obj.Key).map((obj) => ({ Key: obj.Key! })) ?? []
            if (objects.length > 0) {
                await s3.send(
                    new DeleteObjectsCommand({
                        Bucket: bucket,
                        Delete: {
                            Objects: objects,
                            Quiet: true,
                        },
                    })
                )
                deletedCount += objects.length
            }
            continuationToken = listed.IsTruncated ? listed.NextContinuationToken : undefined
        } while (continuationToken)

        return deletedCount
    }
}
