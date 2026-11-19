import { ActionBarItem, Button, DashboardRouteDefinition, ListPage, DetailPageButton, api, Link, useQueryClient } from "@vendure/dashboard"
import { PlusIcon, Trash2Icon } from "lucide-react"
import gql from "graphql-tag"
import { getTranslation, useTranslations } from "../hooks/use-translations"

// The fields you select here will be automatically used to generate the appropriate columns in the
// data table below.

export const getTextblockList = gql(`
    query TextblockListQuery($options: TextblockListOptions) {
        textblocks(options: $options) {
            items {
                id
                createdAt
                updatedAt
                enabled
                languageCode
                name
                description
            }
            totalItems
        }
    }
`)

export const deleteTextblock = gql(`
    mutation DeleteTextblock($id: ID!) {
        deleteTextblock(id: $id) {
            result
            message
        }
    }
`)

export const textblockList: DashboardRouteDefinition = {
    navMenuItem: {
        sectionId: "content-management",
        id: "textblocks",
        url: "/textblocks",
        title: getTranslation('textblock.title'),
        requiresPermission: "ReadTextblock",
    },
    path: "/textblocks",
    loader: () => ({
        breadcrumb: getTranslation('textblock.title'),
    }),

    component: (route) => <TextblockListPage route={route} />,
}

function TextblockListPage({ route }: { route: any }) {
    const { t } = useTranslations()
    const queryClient = useQueryClient()
    
    return (
        <ListPage
            pageId="textblock-list"
            title={t('textblock.title')}
            listQuery={getTextblockList}
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
                                    if (confirm(t('textblock.deleteConfirm').replace('{count}', String(selection.length)))) {
                                        for (const item of selection) {
                                            await api.mutate(deleteTextblock, { id: item.id });
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
                name: {
                    cell: ({ row }) => {
                        const textblock: any = row.original
                        return <DetailPageButton id={textblock.id} label={textblock.name} />
                    },
                },
            }}
        >
            <ActionBarItem itemId="create-button">
                <Button render={<Link to="./new" />}>
                    <PlusIcon className="mr-2 h-4 w-4" />
                    {t('textblock.newTextblock')}
                </Button>
            </ActionBarItem>
        </ListPage>
    )
}
