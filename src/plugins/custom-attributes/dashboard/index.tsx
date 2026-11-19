import { defineDashboardExtension } from '@vendure/dashboard';
import { FileTextIcon } from 'lucide-react';

import { attributePropertyList } from './components/attribute-property-list';
import { attributePropertyDetail } from './components/attribute-property-detail';
import { ProductAttributeBlock } from './components/product-attribute-block';
import { ProductVariantAttributeBlock } from './components/product-variant-attribute-block';
import { FacetAttributeBlock } from './components/facet-attribute-block';
import { TranslatedTitle } from './components/translated-title';

export default defineDashboardExtension({
    routes: [attributePropertyList, attributePropertyDetail],
    pageBlocks: [
        {
            id: 'product-attributes',
            title: <TranslatedTitle translationKey="custom-attributes.product-attribute.title" fallback="Custom Attributes" />,
            location: {
                pageId: 'product-detail',
                column: 'main',
                position: {
                    blockId: 'facet-values',
                    order: 'after',
                },
            },
            component: ProductAttributeBlock,
            requiresPermission: "ReadProductAttribute",
        },
        {
            id: 'product-variant-attributes',
            title: <TranslatedTitle translationKey="custom-attributes.productvariant-attribute.title" fallback="Custom Attributes" />,
            location: {
                pageId: 'product-variant-detail',
                column: 'main',
                position: {
                    blockId: 'facet-values',
                    order: 'after',
                },
            },
            component: ProductVariantAttributeBlock,
            requiresPermission: "ReadProductVariantAttribute",
        },
        {
            id: 'facet-attributes',
            title: <TranslatedTitle translationKey="custom-attributes.facet-attribute.title" fallback="Custom Attributes" />,
            location: {
                pageId: 'facet-detail',
                column: 'main',
                position: {
                    blockId: 'facet-values',
                    order: 'after',
                },
            },
            component: FacetAttributeBlock,
            requiresPermission: "ReadFacetAttribute",
        },
    ],
});