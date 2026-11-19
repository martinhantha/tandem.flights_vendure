import { useTranslations } from '../hooks/use-translations';

interface TranslatedTitleProps {
    translationKey: string;
    fallback?: string;
}

/**
 * A component that renders a translated title.
 * Used for pageBlocks titles which accept React.ReactNode.
 */
export function TranslatedTitle({ translationKey, fallback }: TranslatedTitleProps) {
    const { t } = useTranslations();
    return <>{t(translationKey, fallback)}</>;
}
