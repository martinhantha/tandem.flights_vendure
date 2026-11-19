/**
 * Italian tax number check for the checkout: either a personal codice fiscale (16 characters,
 * including the "omocodia" substitutions) or an 11-digit partita IVA / numeric codice fiscale of a company.
 * Only the format is checked, not the check digit - the old TYPO3 shop only required the field to be filled.
 */
const CODICE_FISCALE = /^[A-Z]{6}[0-9LMNPQRSTUV]{2}[ABCDEHLMPRST][0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{3}[A-Z]$/
const PARTITA_IVA = /^[0-9]{11}$/

export function normalizeTaxNumber(value: unknown): string {
    return typeof value === "string" ? value.replace(/[\s.-]/g, "").toUpperCase() : ""
}

export function isValidItalianTaxNumber(value: unknown): boolean {
    const normalized = normalizeTaxNumber(value)
    return CODICE_FISCALE.test(normalized) || PARTITA_IVA.test(normalized)
}
