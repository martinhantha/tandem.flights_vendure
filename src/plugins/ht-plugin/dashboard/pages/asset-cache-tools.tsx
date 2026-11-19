import { Button, DashboardRouteDefinition, Page, PageTitle, PageLayout, PageBlock, api, toast } from "@vendure/dashboard"
import { useState } from "react"
import { DatabaseIcon, LayersIcon, Loader2Icon, RefreshCwIcon, RotateCwIcon } from "lucide-react"
import { getTranslation, useTranslations } from "../hooks/use-translations"

const REFRESH_IMAGE_CACHE = /* GraphQL */ `
    mutation DashboardRefreshImageCache {
        refreshImageCache {
            success
            message
            deletedCount
        }
    }
`

const REGENERATE_ASSET_PREVIEWS = /* GraphQL */ `
    mutation DashboardRegenerateAssetPreviews {
        regenerateAssetPreviews {
            success
            message
            regeneratedCount
            failedCount
        }
    }
`

const NORMALIZE_ASSET_SOURCES = /* GraphQL */ `
    mutation DashboardNormalizeAssetSources {
        normalizeAssetSources {
            success
            message
            normalizedCount
            skippedCount
            failedCount
        }
    }
`

const CLEAR_COLLECTION_MENU_CACHE = /* GraphQL */ `
    mutation DashboardClearCollectionMenuCache {
        clearCollectionMenuCache {
            success
            message
            deletedKeys
        }
    }
`

export const assetCacheTools: DashboardRouteDefinition = {
    path: "/asset-cache",
    navMenuItem: {
        sectionId: "system",
        id: "asset-cache",
        url: "/asset-cache",
        title: getTranslation("assetCache.title"),
        requiresPermission: ["UpdateCatalog", "SuperAdmin"],
        order: 10,
    },
    loader: () => ({
        breadcrumb: getTranslation("assetCache.title"),
    }),
    component: () => <AssetCacheToolsPage />,
}

function AssetCacheToolsPage() {
    const { t } = useTranslations()
    const [clearing, setClearing] = useState(false)
    const [clearingMenu, setClearingMenu] = useState(false)
    const [regenerating, setRegenerating] = useState(false)
    const [normalizing, setNormalizing] = useState(false)

    const busy = clearing || clearingMenu || regenerating || normalizing

    const clearTransformCache = async () => {
        setClearing(true)
        try {
            const raw = (await api.mutate(REFRESH_IMAGE_CACHE, {})) as {
                refreshImageCache?: { success: boolean; message: string; deletedCount: number }
            }
            const r = raw?.refreshImageCache ?? (raw as { data?: { refreshImageCache?: typeof raw.refreshImageCache } })?.data?.refreshImageCache
            if (r?.success) {
                toast.success(t("assetCache.successCleared"), {
                    description: `${r.message} (${r.deletedCount})`,
                })
            } else {
                toast.error(t("assetCache.failed"), { description: r?.message })
            }
        } catch (err) {
            toast.error(t("assetCache.failed"), {
                description: err instanceof Error ? err.message : undefined,
            })
        } finally {
            setClearing(false)
        }
    }

    const clearMenuCache = async () => {
        setClearingMenu(true)
        try {
            const raw = (await api.mutate(CLEAR_COLLECTION_MENU_CACHE, {})) as {
                clearCollectionMenuCache?: { success: boolean; message: string; deletedKeys: number }
            }
            const r = raw?.clearCollectionMenuCache ?? (raw as { data?: { clearCollectionMenuCache?: typeof raw.clearCollectionMenuCache } })?.data?.clearCollectionMenuCache
            if (r?.success) {
                toast.success(t("assetCache.successMenuCleared"), {
                    description: `${r.message} (${r.deletedKeys})`,
                })
            } else {
                toast.error(t("assetCache.failed"), { description: r?.message })
            }
        } catch (err) {
            toast.error(t("assetCache.failed"), {
                description: err instanceof Error ? err.message : undefined,
            })
        } finally {
            setClearingMenu(false)
        }
    }

    const regeneratePreviews = async () => {
        if (!window.confirm(t("assetCache.regenerateConfirm"))) {
            return
        }
        setRegenerating(true)
        try {
            const raw = (await api.mutate(REGENERATE_ASSET_PREVIEWS, {})) as {
                regenerateAssetPreviews?: {
                    success: boolean
                    message: string
                    regeneratedCount: number
                    failedCount: number
                }
            }
            const r = raw?.regenerateAssetPreviews ?? (raw as { data?: { regenerateAssetPreviews?: typeof raw.regenerateAssetPreviews } })?.data?.regenerateAssetPreviews
            if (r?.success) {
                toast.success(t("assetCache.successRegenerated"), {
                    description: `${r.regeneratedCount} ok, ${r.failedCount} failed`,
                })
            } else {
                toast.error(t("assetCache.failed"), { description: r?.message })
            }
        } catch (err) {
            toast.error(t("assetCache.failed"), {
                description: err instanceof Error ? err.message : undefined,
            })
        } finally {
            setRegenerating(false)
        }
    }

    const normalizeSources = async () => {
        if (!window.confirm(t("assetCache.normalizeConfirm"))) {
            return
        }
        setNormalizing(true)
        try {
            const raw = (await api.mutate(NORMALIZE_ASSET_SOURCES, {})) as {
                normalizeAssetSources?: {
                    success: boolean
                    message: string
                    normalizedCount: number
                    skippedCount: number
                    failedCount: number
                }
            }
            const r = raw?.normalizeAssetSources ?? (raw as { data?: { normalizeAssetSources?: typeof raw.normalizeAssetSources } })?.data?.normalizeAssetSources
            if (r?.success) {
                toast.success(t("assetCache.successNormalized"), {
                    description: `${r.normalizedCount} ok, ${r.skippedCount} skipped, ${r.failedCount} failed`,
                })
            } else {
                toast.error(t("assetCache.failed"), { description: r?.message })
            }
        } catch (err) {
            toast.error(t("assetCache.failed"), {
                description: err instanceof Error ? err.message : undefined,
            })
        } finally {
            setNormalizing(false)
        }
    }

    return (
        <Page>
            <PageTitle>{t("assetCache.title")}</PageTitle>
            <PageLayout>
                <PageBlock column="main" blockId="asset-cache-main" title={t("assetCache.introTitle")} description={t("assetCache.intro")}>
                    <div className="flex max-w-xl flex-col gap-6">
                        <div className="space-y-2 rounded-lg border p-4">
                            <div className="flex items-start gap-3">
                                <DatabaseIcon className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
                                <div className="min-w-0 flex-1">
                                    <h3 className="font-medium">{t("assetCache.clearTransformCache")}</h3>
                                    <p className="text-muted-foreground mt-1 text-sm">{t("assetCache.clearTransformCacheHint")}</p>
                                    <Button type="button" className="mt-3" variant="secondary" disabled={busy} onClick={clearTransformCache}>
                                        {clearing ? (
                                            <>
                                                <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                                                {t("common.loading")}
                                            </>
                                        ) : (
                                            t("assetCache.clearTransformCache")
                                        )}
                                    </Button>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2 rounded-lg border p-4">
                            <div className="flex items-start gap-3">
                                <LayersIcon className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
                                <div className="min-w-0 flex-1">
                                    <h3 className="font-medium">{t("assetCache.clearCollectionMenuCache")}</h3>
                                    <p className="text-muted-foreground mt-1 text-sm">{t("assetCache.clearCollectionMenuCacheHint")}</p>
                                    <Button
                                        type="button"
                                        className="mt-3"
                                        variant="secondary"
                                        disabled={busy}
                                        onClick={clearMenuCache}
                                    >
                                        {clearingMenu ? (
                                            <>
                                                <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                                                {t("common.loading")}
                                            </>
                                        ) : (
                                            t("assetCache.clearCollectionMenuCache")
                                        )}
                                    </Button>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2 rounded-lg border p-4">
                            <div className="flex items-start gap-3">
                                <RotateCwIcon className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
                                <div className="min-w-0 flex-1">
                                    <h3 className="font-medium">{t("assetCache.normalizeSources")}</h3>
                                    <p className="text-muted-foreground mt-1 text-sm">{t("assetCache.normalizeSourcesHint")}</p>
                                    <Button type="button" className="mt-3" variant="outline" disabled={busy} onClick={normalizeSources}>
                                        {normalizing ? (
                                            <>
                                                <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                                                {t("common.loading")}
                                            </>
                                        ) : (
                                            t("assetCache.normalizeSources")
                                        )}
                                    </Button>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2 rounded-lg border p-4">
                            <div className="flex items-start gap-3">
                                <RefreshCwIcon className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
                                <div className="min-w-0 flex-1">
                                    <h3 className="font-medium">{t("assetCache.regeneratePreviews")}</h3>
                                    <p className="text-muted-foreground mt-1 text-sm">{t("assetCache.regeneratePreviewsHint")}</p>
                                    <Button type="button" className="mt-3" variant="outline" disabled={busy} onClick={regeneratePreviews}>
                                        {regenerating ? (
                                            <>
                                                <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                                                {t("common.loading")}
                                            </>
                                        ) : (
                                            t("assetCache.regeneratePreviews")
                                        )}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </PageBlock>
            </PageLayout>
        </Page>
    )
}
