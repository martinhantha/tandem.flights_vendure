import { createCipheriv, createDecipheriv, randomBytes } from "crypto"

const ALGO = "aes-256-gcm"
const KEY_BYTES = 32
const IV_BYTES = 12
const VERSION = "v1"

let cachedKey: Buffer | null = null

const getKey = (): Buffer => {
    if (cachedKey) return cachedKey
    const raw = process.env.FIELD_ENCRYPTION_KEY
    if (!raw) throw new Error("FIELD_ENCRYPTION_KEY env var is not set")
    const buf = Buffer.from(raw, "base64")
    if (buf.length !== KEY_BYTES) throw new Error(`FIELD_ENCRYPTION_KEY must decode to ${KEY_BYTES} bytes (got ${buf.length}). Generate with: openssl rand -base64 32`)
    cachedKey = buf
    return buf
}

export const encryptField = (plain: string): string => {
    const iv = randomBytes(IV_BYTES)
    const cipher = createCipheriv(ALGO, getKey(), iv)
    const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()])
    const tag = cipher.getAuthTag()
    return `${VERSION}:${iv.toString("base64")}:${tag.toString("base64")}:${ct.toString("base64")}`
}

export const decryptField = (payload: string): string => {
    const parts = payload.split(":")
    if (parts.length !== 4 || parts[0] !== VERSION) throw new Error("Unsupported encrypted payload format")
    const [, ivB64, tagB64, ctB64] = parts
    const decipher = createDecipheriv(ALGO, getKey(), Buffer.from(ivB64, "base64"))
    decipher.setAuthTag(Buffer.from(tagB64, "base64"))
    const pt = Buffer.concat([decipher.update(Buffer.from(ctB64, "base64")), decipher.final()])
    return pt.toString("utf8")
}

export const last4 = (value: string): string => {
    const compact = value.replace(/\s+/g, "")
    return compact.slice(-4)
}

// Country code plus last 4 is not sensitive on its own and is enough for the
// customer to recognise which account is stored.
export const maskIban = (value: string): string => {
    const compact = value.replace(/\s+/g, "").toUpperCase()
    return `${compact.slice(0, 2)}•• •••• •••• ${compact.slice(-4)}`
}
