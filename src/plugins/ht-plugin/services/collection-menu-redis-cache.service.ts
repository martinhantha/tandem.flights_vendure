import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common"
import { Logger } from "@vendure/core"
import Redis from "ioredis"
import { isLocalRedisHostProfile, resolveAppRedisOptions, resolveAppRedisUrl } from "../config/redis-url"

const loggerCtx = "CollectionMenuRedisCache"

/**
 * Redis cache for shop collection menu payloads (facet values / products per collection).
 * Keys share a fixed prefix so they can be bulk-deleted via {@link deleteByPrefix}.
 *
 * Uses the same default Redis target as {@link RedisCachePlugin} (see `src/config/redis-url.ts`).
 * Disable only this cache: `COLLECTION_MENU_REDIS_DISABLED=1`
 */
@Injectable()
export class CollectionMenuRedisCacheService implements OnModuleDestroy, OnModuleInit {
    /** All keys written by this service start with this prefix (SCAN + DEL). */
    static readonly KEY_PREFIX = "vendure:ht:collection-menu:"

    private client: Redis | null = null
    private readonly redisUrl: string | undefined
    private readonly ttlSeconds: number

    constructor() {
        this.redisUrl = resolveCollectionMenuRedisUrl()
        const ttlRaw = process.env.COLLECTION_MENU_CACHE_TTL_SECONDS
        const parsed = ttlRaw != null && ttlRaw !== "" ? Number(ttlRaw) : NaN
        this.ttlSeconds = Number.isFinite(parsed) && parsed > 0 ? parsed : 300
    }

    onModuleInit(): void {
        if (this.redisUrl) {
            const mode = isLocalRedisHostProfile() ? "local (127.0.0.1:6379)" : "docker (vendure-redis:6379)"
            Logger.info(`Collection menu cache: Redis enabled — ${mode}, TTL ${this.ttlSeconds}s`, loggerCtx)
        } else {
            Logger.warn(`Collection menu cache: Redis disabled (COLLECTION_MENU_REDIS_DISABLED=1)`, loggerCtx)
        }
    }

    isEnabled(): boolean {
        return !!this.redisUrl
    }

    getTtlSeconds(): number {
        return this.ttlSeconds
    }

    private getClient(): Redis | null {
        if (!this.redisUrl) {
            return null
        }
        if (this.client) {
            return this.client
        }
        this.client = new Redis({
            ...resolveAppRedisOptions(),
            maxRetriesPerRequest: 3,
            enableReadyCheck: true,
            lazyConnect: true,
        })
        this.client.on("error", (err: Error) => {
            Logger.warn(`Redis error: ${err?.message ?? err}`, loggerCtx)
        })
        return this.client
    }

    async onModuleDestroy(): Promise<void> {
        if (this.client) {
            await this.client.quit().catch(() => this.client?.disconnect())
            this.client = null
        }
    }

    facetKey(channelId: string, languageCode: string, collectionId: string, options: { skip?: number; take?: number } | undefined): string {
        const skip = options?.skip ?? 0
        const take = options?.take != null ? String(options.take) : "all"
        return `${CollectionMenuRedisCacheService.KEY_PREFIX}facets:${channelId}:${languageCode}:${collectionId}:${skip}:${take}`
    }

    productsKey(channelId: string, languageCode: string, collectionId: string, options: { skip?: number; take?: number } | undefined): string {
        const skip = options?.skip ?? 0
        const take = options?.take != null ? String(options.take) : "all"
        return `${CollectionMenuRedisCacheService.KEY_PREFIX}products:v2:${channelId}:${languageCode}:${collectionId}:${skip}:${take}`
    }

    async getJson<T>(key: string): Promise<T | null> {
        const redis = this.getClient()
        if (!redis) {
            return null
        }
        const raw = await redis.get(key)
        if (raw == null) {
            return null
        }
        try {
            return JSON.parse(raw) as T
        } catch {
            Logger.warn(`Invalid JSON in cache key ${key}, deleting`, loggerCtx)
            await redis.del(key).catch(() => undefined)
            return null
        }
    }

    async setJson(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
        const redis = this.getClient()
        if (!redis) {
            return
        }
        const ttl = ttlSeconds ?? this.ttlSeconds
        const payload = this.stringifyForCache(value)
        await redis.set(key, payload, "EX", ttl)
    }

    /**
     * Deletes all keys written by this service (prefix match via SCAN).
     */
    async deleteByPrefix(): Promise<number> {
        const redis = this.getClient()
        if (!redis) {
            return 0
        }
        const pattern = `${CollectionMenuRedisCacheService.KEY_PREFIX}*`
        let deleted = 0
        let cursor = "0"
        do {
            const [next, keys] = await redis.scan(cursor, "MATCH", pattern, "COUNT", "200")
            cursor = next
            if (keys.length > 0) {
                deleted += await redis.del(...keys)
            }
        } while (cursor !== "0")
        return deleted
    }

    private stringifyForCache(value: unknown): string {
        const seen = new WeakSet<object>()
        return JSON.stringify(value, (_key, val) => {
            if (typeof val === "bigint") {
                return val.toString()
            }
            if (typeof val === "object" && val !== null) {
                if (seen.has(val)) {
                    return undefined
                }
                seen.add(val)
            }
            return val
        })
    }
}

function resolveCollectionMenuRedisUrl(): string | undefined {
    if (process.env.COLLECTION_MENU_REDIS_DISABLED === "1") {
        return undefined
    }
    return resolveAppRedisUrl()
}
