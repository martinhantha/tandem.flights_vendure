/**
 * Minimal in-memory fixed-window rate limiter (per key, e.g. client IP). Good enough for one
 * server process; with several server replicas each one counts on its own.
 */
export class FixedWindowRateLimiter {
    private readonly hits = new Map<string, { count: number; resetAt: number }>()
    private lastCleanup = Date.now()

    constructor(private readonly max: number, private readonly windowMs: number) {}

    /** Counts a hit for `key` and returns false once the limit of the current window is exceeded. */
    take(key: string, now = Date.now()): boolean {
        this.cleanup(now)
        const entry = this.hits.get(key)
        if (!entry || entry.resetAt <= now) {
            this.hits.set(key, { count: 1, resetAt: now + this.windowMs })
            return true
        }
        entry.count++
        return entry.count <= this.max
    }

    private cleanup(now: number) {
        if (now - this.lastCleanup < this.windowMs) return
        this.lastCleanup = now
        for (const [key, entry] of this.hits) {
            if (entry.resetAt <= now) this.hits.delete(key)
        }
    }
}
