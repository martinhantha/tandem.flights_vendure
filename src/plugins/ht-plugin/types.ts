import { Product } from "@vendure/core"
import { CustomProductFields, CustomPaymentMethodFields, CustomPaymentFields, CustomOrderFields, CustomCollectionFields, CustomGlobalSettingsFields, CustomCustomerFields } from "@vendure/core/dist/entity/custom-entity-fields"

// Custom fields are nullable unless `nullable: false` is set, so fields without a defaultValue are `| null`.
// Relation fields are only present when joined, hence `?`.
declare module "@vendure/core/dist/entity/custom-entity-fields" {
    interface CustomProductFields {
        shortDescription: string | null
        relatedProducts?: Product[]
        sold: number
        metaTitle: string | null
        metaDescription: string | null
        sorting: number
        usps: string | null
        deliveryTime: string | null
        isDigital: boolean
    }
    interface CustomProductVariantFields {
        novelty: boolean
        bestseller: boolean
        isVoucher: boolean
        hiddenInOverview: boolean
        sold: number
        sorting: number
        availabilityInfoText: string | null
        lowStockThreshold: number | null
    }
    interface CustomProductVariantPriceFields {
        referencePrice: number | null
    }
    interface CustomCollectionFields {
        metaTitle: string | null
        metaDescription: string | null
        isProductVariantsOverview: boolean
    }
    interface CustomGlobalSettingsFields {
        orderEmailCopyTo: string | null
        lowStockEmailTo: string | null
        lowStockThreshold: number
    }
    interface CustomCustomerFields {
        marketing: boolean | null
        isBusiness: boolean | null
        extendedInfo: string | null
        preferredLanguage: string | null
        sepaAccountHolderEnc: string | null
        sepaIbanEnc: string | null
        sepaIbanMasked: string | null
        sepaIbanLast4: string | null
        sepaBic: string | null
        sepaBankName: string | null
        sepaSavedAt: Date | null
    }
    interface CustomAddressFields {
        sdi: string | null
        taxnumber: string | null
    }
    interface CustomOrderFields {
        languageCode: string | null
        ipAddress: string | null
        selectedPaymentMethodCode: string | null
        withdrawalCount: number
    }
    interface CustomOrderLineFields {
        voucher: {
            lang: string
            salutation: string
            message: string
            image: string
        } | null
        discountPercent: number
    }
    interface CustomPaymentMethodFields {
        emailText: string | null
        sorting: number
    }
    interface CustomShippingMethodFields {
        sorting: number
    }
    interface CustomFacetFields {
        filter: boolean
        sorting: number
    }
    interface CustomFacetValueFields {
        displayName: string | null
        filter: boolean
        sorting: number
    }
    interface CustomProductOptionFields {
        sorting: number
    }
}
