import { LanguageCode, PluginCommonModule, Type, VendurePlugin } from '@vendure/core';
import { CUSTOM_ATTRIBUTES_PLUGIN_OPTIONS } from './constants';
import { PluginInitOptions } from './options';
import { CustomAttributesSchema } from './entities/schema';
import { CustomAttributesSchemaAdmin } from './entities/schema-admin';

//Product Attribute
import { ProductAttribute } from './entities/productAttribute/entity';
import { ProductAttributeTranslation } from './entities/productAttribute/translation.entity';
import { ProductAttributeService } from './entities/productAttribute/service';
import { ProductAttributeAdminResolver } from './entities/productAttribute/resolver';
import { productAttributePermission } from './entities/productAttribute/permission';

//ProductVariant Attribute
import { ProductVariantAttribute } from './entities/productVariantAttribute/entity';
import { ProductVariantAttributeTranslation } from './entities/productVariantAttribute/translation.entity';
import { ProductVariantAttributeService } from './entities/productVariantAttribute/service';
import { productVariantAttributePermission } from './entities/productVariantAttribute/permission';
import { ProductVariantAttributeAdminResolver } from './entities/productVariantAttribute/resolver';

//Facet Attribute
import { FacetAttribute } from './entities/facetAttribute/entity';
import { FacetAttributeTranslation } from './entities/facetAttribute/translation.entity';
import { FacetAttributeService } from './entities/facetAttribute/service';
import { facetAttributePermission } from './entities/facetAttribute/permission';
import { FacetAttributeAdminResolver } from './entities/facetAttribute/resolver';

//Attribute Properties
import { AttributeProperty } from './entities/attributeProperties/entity';
import { AttributePropertyTranslation } from './entities/attributeProperties/translation.entity';
import { attributePropertiesPermission } from './entities/attributeProperties/permission';
import { AttributePropertiesService } from './entities/attributeProperties/service';
import { AttributePropertiesAdminResolver } from './entities/attributeProperties/resolver';
import './types';

@VendurePlugin({
    imports: [PluginCommonModule],
    providers: [
        ProductAttributeService,
        ProductVariantAttributeService,
        FacetAttributeService,
        AttributePropertiesService,
    ],
    entities: [
        ProductAttribute,
        ProductAttributeTranslation,
        ProductVariantAttribute,
        ProductVariantAttributeTranslation,
        FacetAttribute,
        FacetAttributeTranslation,
        AttributeProperty,
        AttributePropertyTranslation,
    ],
    shopApiExtensions: {
        schema: CustomAttributesSchema,
        resolvers: [
            ProductAttributeAdminResolver,
            ProductVariantAttributeAdminResolver,
            FacetAttributeAdminResolver,
            AttributePropertiesAdminResolver,
        ],
    },
    adminApiExtensions: {
        schema: CustomAttributesSchemaAdmin,
        resolvers: [
            ProductAttributeAdminResolver,
            ProductVariantAttributeAdminResolver,
            FacetAttributeAdminResolver,
            AttributePropertiesAdminResolver,
        ],
    },
    configuration: (config) => {
        config.customFields.Product.push({
            type: 'relation',
            entity: ProductAttribute,
            name: 'attributes',
            nullable: true,
            list: true,
            label: [{ languageCode: LanguageCode.de, value: 'Attribut' },
                { languageCode: LanguageCode.en, value: 'Attribute' },
                { languageCode: LanguageCode.it, value: 'Attributo' }
            ],
            eager: true,
            public: true,
            internal: true,
            inverseSide: (productAttribute: ProductAttribute) => productAttribute.product,
        });
        config.customFields.ProductVariant.push({
            name: 'attributes',
            list: true,
            nullable: true,
            type: 'relation',
            entity: ProductVariantAttribute,
            public: true,
            label: [{ languageCode: LanguageCode.de, value: 'Attribut' },
                { languageCode: LanguageCode.en, value: 'Attribute' },
                { languageCode: LanguageCode.it, value: 'Attributo' }
            ],
            internal: true,
            inverseSide: (productVariantAttribute: ProductVariantAttribute) => productVariantAttribute.productVariant,
        });
        config.customFields.Facet.push({
            name: 'attributes',
            list: true,
            nullable: true,
            type: 'relation',
            entity: FacetAttribute,
            public: true,
            label: [{ languageCode: LanguageCode.de, value: 'Attribut' },
                { languageCode: LanguageCode.en, value: 'Attribute' },
                { languageCode: LanguageCode.it, value: 'Attributo' }
            ],
            internal: true,
            inverseSide: (facetAttribute: FacetAttribute) => facetAttribute.facet,
        });

        config.authOptions.customPermissions.push(productAttributePermission);
        config.authOptions.customPermissions.push(productVariantAttributePermission);
        config.authOptions.customPermissions.push(facetAttributePermission);
        config.authOptions.customPermissions.push(attributePropertiesPermission);

        return config;
    },
    dashboard: './dashboard/index.tsx',
    compatibility: '^3.0.0',
})
export class CustomAttributesPlugin {
    static options: PluginInitOptions;

    static init(options: PluginInitOptions): Type<CustomAttributesPlugin> {
        this.options = options;
        return CustomAttributesPlugin;
    }
}
