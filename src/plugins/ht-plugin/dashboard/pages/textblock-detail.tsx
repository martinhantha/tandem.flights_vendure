import { DashboardRouteDefinition, detailPageRouteLoader, useDetailPage, Page, PageTitle, PageActionBar, ActionBarItem, Button, PageLayout, PageBlock, FormFieldWrapper, DetailFormGrid, Switch, Input, Textarea, CustomFieldsPageBlock, AnyRoute, useNavigate, toast } from "@vendure/dashboard"
import { useEffect, useState, useRef, useCallback } from "react"
import { TranslatableFormFieldWrapper } from "@/vdb/components/shared/translatable-form-field.js"
import { useServerConfig } from "@/vdb/hooks/use-server-config.js"
import { RichTextInput } from "../components/rich-text-input.js"
import { graphql } from "@/gql"
import { getTranslation, useTranslations } from "../hooks/use-translations"

const textblockDetailDocument = graphql(`
    query GetTextblockDetail($id: ID!) {
        textblock(id: $id) {
            id
            name
            description
            enabled
            languageCode
            createdAt
            updatedAt
            translations {
                id
                languageCode
                description
            }
        }
    }
`)

const createTextblockDocument = graphql(`
    mutation CreateTextblock($input: CreateTextblockInput!) {
        createTextblock(input: $input) {
            id
            name
            description
            enabled
            languageCode
            createdAt
            updatedAt
            translations {
                id
                languageCode
                description
            }
        }
    }
`)

const updateTextblockDocument = graphql(`
    mutation UpdateTextblock($input: UpdateTextblockInput!) {
        updateTextblock(input: $input) {
            id
            name
            description
            enabled
            languageCode
            createdAt
            updatedAt
            translations {
                id
                languageCode
                description
            }
        }
    }
`)

export const textblockDetail: DashboardRouteDefinition = {
    path: "/textblocks/$id",
    loader: detailPageRouteLoader({
        queryDocument: textblockDetailDocument,
        breadcrumb: (isNew, entity) => [{ path: "/textblocks", label: getTranslation('textblock.title') }, isNew ? getTranslation('textblock.newTextblock') : entity?.name],
    }),
    component: (route) => {
        return <ArticleDetailPage route={route} />
    },
}

function ArticleDetailPage({ route }: { route: AnyRoute }) {
    const { t } = useTranslations()
    
    // Detect if value is HTML or plain text
    function detectInitialMode(value) {
        if (typeof value !== "string") return "plain";
        // Simple HTML tag detection
        return /<[^>]+>/.test(value) ? "rich" : "plain";
    }

    // Content field with auto-detect and manual toggle
    function TextblockContentField(field) {
        const [mode, setMode] = useState<"rich" | "plain">("plain");
        const didAutoDetect = useRef(false);

        // Auto-detect mode the first time a non-empty value appears
        useEffect(() => {
            if (!didAutoDetect.current && field.value && field.value !== "") {
                setMode(detectInitialMode(field.value));
                didAutoDetect.current = true;
            }
        }, [field.value]);

        const toggle = () => setMode(mode === "rich" ? "plain" : "rich");
        return (
            <>
                <Button type="button" variant="ghost" onClick={toggle}>
                    {mode === "rich" ? t('common.plainText') : t('common.richText')}
                </Button>
                {mode === "rich"
                    ? <RichTextInput {...field} />
                    : <Textarea value={field.value} onChange={(event) => field.onChange(event.target.value)} autoFocus />}
            </>
        );
    }

    // Memoize the render function to avoid remounting
    const renderTextblockContentField = useCallback((props) => <TextblockContentField {...props.field} />, []);
    const params = route.useParams()
    const navigate = useNavigate()
    const creatingNewEntity = params.id === "new"
    const serverConfig = useServerConfig()
    const availableLanguages = serverConfig?.availableLanguages ?? []

    const { form, submitHandler, entity, isPending, resetForm } = useDetailPage({
        queryDocument: textblockDetailDocument,
        createDocument: createTextblockDocument,
        updateDocument: updateTextblockDocument,
        setValuesForUpdate: (textblock) => {
            return {
                id: textblock?.id ?? "",
                enabled: textblock?.enabled ?? true,
                name: textblock?.name ?? "",
                translations: (textblock?.translations ?? []).map((translation) => ({
                    id: translation?.id,
                    languageCode: translation?.languageCode,
                    description: translation?.description ?? "",
                })),
            }
        },
        params: { id: params.id },
        onSuccess: async (data) => {
            toast(t("textblock.updateSuccess"))
            resetForm()
            if (creatingNewEntity) {
                await navigate({ to: `../$id`, params: { id: data.id } })
            }
        },
        onError: (err) => {
            toast(t("textblock.updateFailed"), {
                description: err instanceof Error ? err.message : undefined,
            })
        },
    })

    useEffect(() => {
        if (!creatingNewEntity || !availableLanguages.length) {
            return
        }
        const currentValues = form.getValues()
        const translations = (currentValues?.translations ?? []) as Array<{ id?: string | null; languageCode?: string | null; description?: string | null }>
        const allLanguagesPresent = availableLanguages.every((lang) => translations.some((translation) => translation?.languageCode === lang))
        if (allLanguagesPresent && translations.length === availableLanguages.length) {
            return
        }
        const normalizedTranslations = availableLanguages.map((languageCode) => {
            const existing = translations.find((translation) => translation?.languageCode === languageCode)
            return {
                id: existing?.id ?? undefined,
                languageCode,
                description: existing?.description ?? "",
            }
        })

        form.reset({
            ...currentValues,
            translations: normalizedTranslations,
        })
    }, [creatingNewEntity, availableLanguages, form])

    return (
        <Page pageId="article-detail" form={form} submitHandler={submitHandler}>
            <PageTitle>{creatingNewEntity ? t("textblock.newTextblock") : (entity?.name ?? "")}</PageTitle>
            <PageActionBar>
                <ActionBarItem itemId="save-button" requiresPermission={["UpdateTextblock"]}>
                    <Button type="submit" disabled={!form.formState.isDirty || !form.formState.isValid || isPending}>
                        {t("common.update")}
                    </Button>
                </ActionBarItem>
            </PageActionBar>
            <PageLayout>
                <PageBlock column="side" blockId="publish-status">
                    <FormFieldWrapper control={form.control} name="enabled" label={t("common.isPublished")} render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} />} />
                </PageBlock>
                <PageBlock column="main" blockId="main-form">
                    <DetailFormGrid>
                        <FormFieldWrapper control={form.control} name="name" label={t("common.name")} render={({ field }) => <Input {...field} />} />
                    </DetailFormGrid>
                    <TranslatableFormFieldWrapper control={form.control} name="description" label={t("common.content")} render={renderTextblockContentField} />
                </PageBlock>
                <CustomFieldsPageBlock column="main" entityType="TextBlock" control={form.control} />
            </PageLayout>
        </Page>
    )
}
