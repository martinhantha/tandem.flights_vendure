import { useRef, useEffect } from "react"
import { 
    DashboardRouteDefinition, 
    api, 
    graphql, 
    Page, 
    PageTitle, 
    PageActionBar,
    ActionBarItem,
    Button, toast } from "@vendure/dashboard"
import { Designer } from "@pdfme/ui"
import { text, barcodes, image, svg, line } from "@pdfme/schemas"
import { getTranslation, useTranslations } from "../hooks/use-translations"

const getPlugins = () => ({
    text,
    line,
    image,
    svg,
    qR: barcodes.qrcode,
    barcodes: barcodes.code128,
})

const getCustomSettingsDocument = graphql(`
    query GetCustomSettings($name: String!) {
        customSettings(name: $name) {
            id
            value
        }
    }
`)

const updateCustomSettingsDocument = graphql(`
    mutation Mutation($input: UpdateCustomSettingsInput!) {
        updateCustomSettings(input: $input) {
            id
        }
    }
`)
const createCustomSettingsDocument = graphql(`
    mutation Mutation($input: CreateCustomSettingsInput!) {
        createCustomSettings(input: $input) {
            id
        }
    }
`)

export const pdfDesigner: DashboardRouteDefinition = {
    navMenuItem: {
        sectionId: "voucher",
        id: "pdf-designer",
        url: "/pdf-designer",
        title: getTranslation('pdfDesigner.title'),
        order: 200,
        requiresPermission: "SuperAdmin",
    },
    path: "/pdf-designer",
    loader: () => ({
        breadcrumb: getTranslation('pdfDesigner.title'),
    }),

    component: (route) => {
        const { t } = useTranslations()
        const designerRef = useRef<HTMLDivElement>(null)
        const designerInstance = useRef<Designer | null>(null)
        const existingCustomSettingId = useRef<string | null>(null)
        const params = route.useParams()
        useEffect(() => {
            let isDisposed = false

            const defaultTemplate = {
                basePdf: { width: 210, height: 297, padding: [10, 10, 10, 10] },
                schemas: [[]],
            }

            async function initDesigner() {
                if (!designerRef.current) return

                let templateToUse: any = defaultTemplate
                try {
                    const result = await api.query(getCustomSettingsDocument, {
                        name: "voucher-template",
                    })
                    const customSetting = (result as any)?.customSettings as { id?: string; value?: string } | null | undefined
                    existingCustomSettingId.current = customSetting?.id ?? null
                    const templateJson = customSetting?.value as string | null | undefined
                    if (templateJson) {
                        templateToUse = JSON.parse(templateJson)
                    }
                } catch (error) {
                    // Non-fatal: just fall back to the default empty template.
                    console.error("Failed to load voucher-template from custom settings", error)
                }

                if (isDisposed) return
                designerInstance.current = new Designer({
                    domContainer: designerRef.current,
                    template: templateToUse,
                    plugins: getPlugins() as ConstructorParameters<typeof Designer>[0]["plugins"],
                })
            }

            void initDesigner()
            return () => {
                isDisposed = true
                designerInstance.current?.destroy()
                designerInstance.current = null
            }
        }, [])

        const saveTemplate = async () => {
            if (!designerInstance.current) return
            const template = designerInstance.current.getTemplate()
            try {
                const value = JSON.stringify(template)
                if (existingCustomSettingId.current) {
                    const result = await api.mutate(updateCustomSettingsDocument, {
                        input: {
                            id: existingCustomSettingId.current,
                            value,
                        },
                    })
                } else {
                    const result = await api.mutate(createCustomSettingsDocument, {
                        input: {
                            name: "voucher-template",
                            value,
                        },
                    })
                    existingCustomSettingId.current = (result as any)?.createCustomSettings?.id ?? null
                }
                toast.success(t('pdfDesigner.templateSaved'))
            } catch (error) {
                toast.error(t('pdfDesigner.saveFailed'), {
                    description: error instanceof Error ? error.message : String(error),
                })
            }
        }
        return (
            <Page pageId="pdf-designer">
                <PageTitle>{t('pdfDesigner.title')}</PageTitle>
                <PageActionBar>
                    <ActionBarItem itemId="save-button">
                        <Button onClick={saveTemplate}>
                            {t('pdfDesigner.saveTemplate')}
                        </Button>
                    </ActionBarItem>
                </PageActionBar>
                <div ref={designerRef} className="h-[calc(100vh-10rem)] w-full" />
            </Page>
        )
    },
}
