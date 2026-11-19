import type { RedisOptions } from "ioredis"

const REDIS_LOCAL = "redis://127.0.0.1:6379"
/** Unique alias on the coolify network (see compose-base.yml). Avoids `redis` which also resolves to coolify-redis. */
const REDIS_DOCKER = "redis://vendure-redis:6379"

/** True when developing on the host against local Redis (not Docker service `redis`). */
export function isLocalRedisHostProfile(): boolean {
    const appLocal = process.env.APP_LOCAL?.toLowerCase()
    if (appLocal === "true" || appLocal === "1") {
        return true
    }
    const appEnv = (process.env.APP_ENV || "").toLowerCase()
    return appEnv === "dev" || appEnv === "development" || appEnv === "local"
}

/**
 * Default Redis URL for this project: local machine vs Docker hostname `redis`.
 * Optional override: `REDIS_URL` (full `redis://` or `rediss://` URL).
 */
export function resolveAppRedisUrl(): string {
    const explicit = process.env.REDIS_URL?.trim()
    if (explicit) {
        return normalizeRedisUrl(explicit)
    }
    return isLocalRedisHostProfile() ? REDIS_LOCAL : REDIS_DOCKER
}

/**
 * Maps `redis://` / `rediss://` URLs to ioredis options for {@link RedisCachePlugin} and other clients.
 */
export function parseRedisUrlToIoredisOptions(url: string): RedisOptions {
    const u = new URL(url)
    const port = u.port ? parseInt(u.port, 10) : u.protocol === "rediss:" ? 6380 : 6379
    const passwordFromEnv = process.env.REDIS_PASSWORD?.trim()
    const usernameFromEnv = process.env.REDIS_USERNAME?.trim()
    const password = u.password ? decodeURIComponent(u.password) : passwordFromEnv || undefined
    const username = u.username ? decodeURIComponent(u.username) : usernameFromEnv || undefined
    return {
        host: u.hostname,
        port,
        username: username || undefined,
        password: password || undefined,
        tls: u.protocol === "rediss:" ? {} : undefined,
        lazyConnect: true,
        maxRetriesPerRequest: 3,
    }
}

/** Resolved app Redis options for ioredis clients. */
export function resolveAppRedisOptions(): RedisOptions {
    return parseRedisUrlToIoredisOptions(resolveAppRedisUrl())
}

/**
 * Accepts `redis://host:port` or bare `host:port` / `host` (default port 6379) for REDIS_URL override.
 */
export function normalizeRedisUrl(raw: string): string {
    if (/^redis:\/\//i.test(raw) || /^rediss:\/\//i.test(raw)) {
        return raw
    }
    if (/^\d+$/.test(raw)) {
        return `redis://127.0.0.1:${raw}`
    }
    if (raw.includes(":") && !raw.includes("/")) {
        return `redis://${raw}`
    }
    return `redis://${raw}:6379`
}
