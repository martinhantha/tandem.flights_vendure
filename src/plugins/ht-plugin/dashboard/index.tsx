import { defineDashboardExtension, toast } from "@vendure/dashboard"
import { FileTextIcon, GiftIcon, SendIcon } from "lucide-react"

import { textblockList } from "./pages/textblock-list"
import { textblockDetail } from "./pages/textblock-detail"
import { voucherDetail } from "./pages/voucher-detail"
import { ProductSortHandle } from "./handler/product-sort-handle"
import { ProductVariantSortHandle } from "./handler/product-variant-sort-handle"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, Button, DropdownMenuItem, PermissionGuard } from "@vendure/dashboard"
import { useState } from "react"
import { api } from "@/vdb/graphql/api.js"
import { pdfDesigner } from "./pages/pdf-designer"
import { voucherList } from "./pages/voucher-list"
import { assetCacheTools } from "./pages/asset-cache-tools"
import { getTranslation, useTranslations } from "./hooks/use-translations"
import { RelatedProductsFormInput } from "./components/related-products-form-input"
import { AccordionFormInput } from "./components/accordion-form-input"
import { SepaRevealAction } from "./components/sepa-reveal-action"
import { ShippingConfigInput } from "./components/shipping-config-input"
import { RichTextInput } from "./components/rich-text-input"

const IS_LOCAL = window.location.hostname === "localhost"

const RESEND_ORDER_EMAIL = /* GraphQL */ `
    mutation ResendOrderEmail($orderId: ID!) {
        resendOrderEmail(orderId: $orderId)
    }
`

const PRODUCT_SORTING_EXTENSION = /* GraphQL */ `
    query ProductSortingExtension {
        products {
            items {
                customFields {
                    sorting
                }
            }
        }
    }
`
const PRODUCTVARIANT_SORTING_EXTENSION = /* GraphQL */ `
    query ProductVariantSortingExtension {
        productVariants {
            items {
                customFields {
                    sorting
                }
            }
        }
    }
`

export default defineDashboardExtension({
    navSections: [
        {
            id: "voucher",
            title: getTranslation("nav.vouchers"),
            icon: GiftIcon,
            placement: "top", // Platform area
            order: 450, // After Customers (400), before Marketing (500)
        },
        {
            id: "content-management",
            title: getTranslation("nav.contentManagement"),
            icon: FileTextIcon,
            placement: "top", // Platform area
            order: 460, // After Customers (400), before Marketing (500)
        },
    ],
    routes: [textblockList, textblockDetail, voucherList, pdfDesigner, voucherDetail, assetCacheTools],
    actionBarItems: [
        {
            pageId: "order-detail",
            type: "dropdown",
            component: ({ context }) => {
                const { t } = useTranslations()
                const order = context.entity as any
                const [confirmOpen, setConfirmOpen] = useState(false)
                const resendOrderEmail = async () => {
                    const orderId = order?.id
                    if (!orderId) {
                        toast.error(t("resendOrderEmail.orderIdMissing"))
                        return
                    }
                    try {
                        await api.mutate(RESEND_ORDER_EMAIL, { orderId })
                        toast.success(t("resendOrderEmail.success"))
                    } catch (err) {
                        toast.error(t("resendOrderEmail.failed"), {
                            description: err instanceof Error ? err.message : undefined,
                        })
                    }
                }
                const HIDDEN_STATES = new Set(["AddingItems", "ArrangingPayment", "Draft", "Cancelled"])
                if (!order?.state || HIDDEN_STATES.has(order.state)) {
                    return null
                }
                return (
                    <>
                        {/* @ts-ignore - React type compatibility */}
                        <DropdownMenuItem variant="default" closeOnClick={false} onClick={() => setConfirmOpen(true)}>
                            <SendIcon className="w-4 h-4" />
                            {t("resendOrderEmail.menuLabel")}
                        </DropdownMenuItem>
                        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    {/* @ts-ignore - React type compatibility */}
                                    <AlertDialogTitle>{t("resendOrderEmail.confirmTitle")}</AlertDialogTitle>
                                    {/* @ts-ignore - React type compatibility */}
                                    <AlertDialogDescription>{t("resendOrderEmail.confirmDescription")}</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel onClick={() => setConfirmOpen(false)}>{t("resendOrderEmail.cancel")}</AlertDialogCancel>
                                    <AlertDialogAction
                                        type="button"
                                        onClick={() => {
                                            resendOrderEmail()
                                            setConfirmOpen(false)
                                        }}
                                    >
                                        {t("resendOrderEmail.confirm")}
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </>
                )
            },
        },
        {
            pageId: "order-detail",
            type: "dropdown",
            component: ({ context }) => {
                if (!context.entity) return null
                return (
                    <PermissionGuard requires={["ReadOrder"]}>
                        <SepaRevealAction order={context.entity} />
                    </PermissionGuard>
                )
            },
        },
    ],
    dataTables: [
        {
            pageId: "product-list",
            extendListDocument: PRODUCT_SORTING_EXTENSION,
            displayComponents: [
                {
                    column: "sorting",
                    component: ProductSortHandle,
                },
            ],
        },
        {
            pageId: "product-variant-list",
            extendListDocument: PRODUCTVARIANT_SORTING_EXTENSION,
            displayComponents: [
                {
                    column: "sorting",
                    component: ProductVariantSortHandle,
                },
            ],
        },
    ],
    login: {
        // Custom logo component for the login page
        logo: {
            component: () => <img src="/dashboard/logo.svg" alt="Tandem Flights Sarntal" className="h-24 w-auto max-w-full" />,
        },
        // Custom text/component before the login form
    },
    customFormComponents: {
        customFields: [
            {
                id: "related-products-form-input",
                component: RelatedProductsFormInput,
            },
            {
                id: "accordion-form-input",
                component: AccordionFormInput,
            },
            {
                id: "shipping-config-input",
                component: ShippingConfigInput,
            },
            {
                id: "ht-rich-text-form-input",
                component: RichTextInput,
            },
        ],
    },
})
