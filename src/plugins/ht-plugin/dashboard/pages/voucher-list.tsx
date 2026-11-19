import { ActionBarItem, Button, DashboardRouteDefinition, ListPage, DetailPageButton, api, Link, useQueryClient } from "@vendure/dashboard"
import { PlusIcon, Trash2Icon } from "lucide-react"
import gql from "graphql-tag"
import { getTranslation, useTranslations } from "../hooks/use-translations"

// The fields you select here will be automatically used to generate the appropriate columns in the
// data table below.

export const getVoucherList = gql(`
    query VoucherListQuery($options: VoucherListOptions) {
        vouchers(options: $options) {
            items {
                id
                createdAt
                updatedAt
                code
                initialAmount
                amount
                validFrom
                validTo
                customer {
                    id
                    firstName
                    lastName
                    emailAddress
                }
            }
            totalItems
        }
    }
`)

export const deleteVoucher = gql(`
    mutation DeleteVoucher($id: ID!) {
        deleteVoucher(id: $id) {
            result
            message
        }
    }
`)

export const voucherList: DashboardRouteDefinition = {
    navMenuItem: {
        sectionId: "voucher",
        id: "vouchers",
        url: "/vouchers",
        title: getTranslation('voucher.title'),
        requiresPermission: "ReadVoucher",
        order: 100,
    },
    path: "/vouchers",
    loader: () => ({
        breadcrumb: getTranslation('voucher.title'),
    }),

    component: (route) => <VoucherListPage route={route} />,
}

function VoucherListPage({ route }: { route: any }) {
    const { t } = useTranslations()
    const queryClient = useQueryClient()
    
    return (
        <ListPage
            pageId="voucher-list"
            title={t('voucher.title')}
            listQuery={getVoucherList}
            route={route}
            bulkActions={[
                {
                    order: 1,
                    component: ({ selection, table }) => {
                        return (
                            <Button
                                variant="ghost"
                                disabled={selection.length === 0}
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={async () => {
                                    if (confirm(t('voucher.deleteConfirm').replace('{count}', String(selection.length)))) {
                                        for (const item of selection) {
                                            await api.mutate(deleteVoucher, { id: item.id });
                                        }
                                        table.resetRowSelection()
                                        await queryClient.invalidateQueries()
                                        await queryClient.refetchQueries()
                                    }
                                }}
                            >
                                <Trash2Icon className="mr-2 h-4 w-4" />
                                {t('common.delete')}
                            </Button>
                        )
                    },
                },
            ]}
            customizeColumns={{
                code: {
                    cell: ({ row }) => {
                        const voucher: any = row.original
                        return <DetailPageButton id={voucher.id} label={voucher.code} />
                    },
                },
            }}
        >
            <ActionBarItem itemId="create-button">
                <Button render={<Link to="./new" />}>
                    <PlusIcon className="mr-2 h-4 w-4" />
                    {t('voucher.newVoucher')}
                </Button>
            </ActionBarItem>
        </ListPage>
    )
}
