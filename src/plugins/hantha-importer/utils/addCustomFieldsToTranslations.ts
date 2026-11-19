export const addCustomFieldsToTranslations = (translations: Array<any>, customFieldTranslations: Array<any>) => {
    if (!translations || translations.length === 0) {
        return customFieldTranslations;
    } else {
        return translations.map((translation) => {
            const customFieldsForLang = customFieldTranslations.find(
                (t) => t.languageCode === translation.languageCode,
            );

            // No custom fields for this language, return original translation
            if (!customFieldsForLang) {
                return translation;
            }

            // If customFields is empty, return translation unchanged
            if (
                !customFieldsForLang.customFields ||
                (typeof customFieldsForLang.customFields === 'object' &&
                    Object.keys(customFieldsForLang.customFields).length === 0)
            ) {
                return translation;
            }

            return {
                ...translation,
                customFields: { ...customFieldsForLang.customFields },
            };
        });
    }
};
