import { useUserSettings } from "@vendure/dashboard"
import en from "../../translations/en.json"
import de from "../../translations/de.json"
import it from "../../translations/it.json"

const translations: Record<string, Record<string, any>> = {
    en,
    de,
    it,
}

/**
 * Get a translation by key path for a specific language.
 * @internal
 */
function getTranslationByKey(lang: string, key: string, fallback?: string): string {
    const currentTranslations = translations[lang] ?? translations.en
    const keys = key.split(".")
    let result: any = currentTranslations
    
    for (const k of keys) {
        if (result && typeof result === "object" && k in result) {
            result = result[k]
        } else {
            return fallback ?? key
        }
    }
    
    return typeof result === "string" ? result : (fallback ?? key)
}

/**
 * Get the current language code from localStorage or navigator.
 * This is useful for getting translations outside of React components.
 */
function getCurrentLanguage(): string {
    // Try to get from localStorage (Vendure stores settings there)
    if (typeof localStorage !== 'undefined') {
        try {
            const storedSettings = localStorage.getItem('vendure-user-settings')
            if (storedSettings) {
                const settings = JSON.parse(storedSettings)
                if (settings.displayLanguage) {
                    // Extract language code (e.g., "de" from "de-AT")
                    return settings.displayLanguage.split(/[-_]/)[0]
                }
            }
        } catch {
            // Ignore JSON parse errors
        }
    }
    // Fallback to browser language
    if (typeof navigator !== 'undefined' && navigator.language) {
        return navigator.language.split("-")[0]
    }
    return "en"
}

/**
 * Get a translation by key path without using a React hook.
 * Useful for static configuration like breadcrumbs and navMenuItem titles.
 * 
 * @example
 * getTranslation("custom-attributes.common.create") // "Create"
 * getTranslation("custom-attributes.common.create", "Fallback") // "Create" or "Fallback"
 */
export function getTranslation(key: string, fallback?: string): string {
    const lang = getCurrentLanguage()
    return getTranslationByKey(lang, key, fallback)
}

/**
 * Simple translation hook for custom-attributes dashboard components.
 * Uses the display language from Vendure Dashboard user settings.
 */
export function useTranslations() {
    const { settings } = useUserSettings()
    
    // Extract the language code (e.g., "de" from "de-AT")
    const lang = settings.displayLanguage?.split(/[-_]/)[0] ?? "en"
    
    /**
     * Get a translation by key path (e.g., "custom-attributes.common.create")
     */
    function t(key: string, fallback?: string): string {
        return getTranslationByKey(lang, key, fallback)
    }
    
    return { t, locale: lang }
}
