export const normalizeIban = (raw: string): string => raw.replace(/\s+/g, "").toUpperCase()

export const normalizeBic = (raw: string): string => raw.replace(/\s+/g, "").toUpperCase()

export const isValidIban = (raw: string): boolean => {
    const iban = normalizeIban(raw)
    if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(iban)) return false
    const rearranged = iban.slice(4) + iban.slice(0, 4)
    const expanded = rearranged.replace(/[A-Z]/g, (ch) => (ch.charCodeAt(0) - 55).toString())
    // mod-97 in chunks to stay within safe integer range
    let remainder = 0
    for (let i = 0; i < expanded.length; i += 7) {
        remainder = parseInt(String(remainder) + expanded.slice(i, i + 7), 10) % 97
    }
    return remainder === 1
}

export const isValidBic = (raw: string): boolean => /^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(normalizeBic(raw))
