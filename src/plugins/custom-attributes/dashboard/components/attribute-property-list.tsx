import {
    ActionBarItem,
    Button,
    DashboardRouteDefinition,
    ListPage,
    DetailPageButton, Link } from '@vendure/dashboard';
import { PlusIcon, CheckIcon, XIcon } from 'lucide-react';
import { graphql } from '@/gql';
import { useTranslations, getTranslation } from '../hooks/use-translations';

const getAttributePropertyListDocument = graphql(`
    query GetAttributePropertyList($options: AttributePropertyListOptions) {
        attributeProperties(options: $options) {
            items {
                id
                createdAt
                updatedAt
                name
                label
                sorting
                code
                type
                defaultValue
                translatable
                comparable
                searchable
                filterable_in_list
                filterable_in_search
            }
            totalItems
        }
    }
`);

const deleteAttributePropertyDocument = graphql(`
    mutation DeleteAttributeProperty($id: ID!) {
        deleteAttributeProperty(id: $id) {
            result
            message
        }
    }
`);

function AttributePropertyListPage({ route }: { route: any }) {
    const { t } = useTranslations();
    
    return (
        <ListPage
            pageId="attribute-property-list"
            title={t('custom-attributes.attribute-properties.title')}
            listQuery={getAttributePropertyListDocument}
            deleteMutation={deleteAttributePropertyDocument}
            route={route}
            customizeColumns={{
                label: {
                    header: t('custom-attributes.attribute-properties.properties.label'),
                    cell: ({ row }) => {
                        const property = row.original;
                        return <DetailPageButton id={property.id} label={property.label} />;
                    },
                },
                code: {
                    header: t('custom-attributes.attribute-properties.properties.code'),
                },
                name: {
                    header: t('custom-attributes.attribute-properties.properties.name'),
                },
                sorting: {
                    header: t('custom-attributes.attribute-properties.properties.sorting'),
                },
                type: {
                    header: t('custom-attributes.attribute-properties.properties.type'),
                },
                comparable: {
                    header: t('custom-attributes.attribute-properties.properties.comparable'),
                    cell: ({ row }) => (
                        row.original.comparable 
                            ? <CheckIcon className="h-4 w-4 text-success" /> 
                            : <XIcon className="h-4 w-4 text-muted-foreground" />
                    ),
                },
                searchable: {
                    header: t('custom-attributes.attribute-properties.properties.searchable'),
                    cell: ({ row }) => (
                        row.original.searchable 
                            ? <CheckIcon className="h-4 w-4 text-success" /> 
                            : <XIcon className="h-4 w-4 text-muted-foreground" />
                    ),
                },
                filterable_in_list: {
                    header: t('custom-attributes.attribute-properties.properties.filterable-in-list'),
                    cell: ({ row }) => (
                        row.original.filterable_in_list 
                            ? <CheckIcon className="h-4 w-4 text-success" /> 
                            : <XIcon className="h-4 w-4 text-muted-foreground" />
                    ),
                },
                filterable_in_search: {
                    header: t('custom-attributes.attribute-properties.properties.filterable-in-search'),
                    cell: ({ row }) => (
                        row.original.filterable_in_search 
                            ? <CheckIcon className="h-4 w-4 text-success" /> 
                            : <XIcon className="h-4 w-4 text-muted-foreground" />
                    ),
                },
            }}
            defaultVisibility={{
                label: true,
                code: true,
                name: true,
                type: true,
                sorting: true,
                translatable: true,
                // comparable: true,
                // searchable: true,
                // filterable_in_list: true,
                // filterable_in_search: true,
            }}
            defaultColumnOrder={[
                'label',
                'code',
                'name',
                'type',
                'sorting',
                'translatable',
                // 'comparable',
                // 'searchable',
                // 'filterable_in_list',
                // 'filterable_in_search',
            ]}
        >
            <ActionBarItem itemId="create-button">
                <Button render={<Link to="./new" />}>
                    <PlusIcon className="mr-2 h-4 w-4" />
                    {t('custom-attributes.common.createAttribute')}
                </Button>
            </ActionBarItem>
        </ListPage>
    );
}

export const attributePropertyList: DashboardRouteDefinition = {
    navMenuItem: {
        sectionId: 'catalog',
        id: 'attribute-properties',
        url: '/attribute-properties',
        title: getTranslation('custom-attributes.attribute-properties.title', 'Attribute Properties'),
        requiresPermission: "ReadAttributeProperties",
    },
    path: '/attribute-properties',
    loader: () => ({
        breadcrumb: getTranslation('custom-attributes.attribute-properties.breadcrumb', 'Attribute Properties'),
    }),
    component: route => <AttributePropertyListPage route={route} />,
};