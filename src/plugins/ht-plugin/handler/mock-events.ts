import { AdjustmentType } from "@vendure/common/lib/generated-shop-types"
import { DeepPartial } from "@vendure/common/lib/shared-types"
import { CurrencyCode, Customer, Order, OrderLine, OrderStateTransitionEvent, Payment, PaymentMethod, Product, ProductVariant, ShippingLine, Surcharge } from "@vendure/core"

class CustomPayment extends Payment {
    constructor(payment: DeepPartial<CustomPayment>) {
        super(payment)
    }

    paymentMethod: PaymentMethod
}

export const mockOrderStateTransitionEvent = new OrderStateTransitionEvent(
    "ArrangingPayment",
    "PaymentSettled",
    {} as any,
    new Order({
        id: "6",
        currencyCode: CurrencyCode.EUR,
        createdAt: "2024-10-31T11:18:29.261Z",
        updatedAt: "2024-10-31T15:24:17.000Z",
        orderPlacedAt: "2024-10-31T13:54:17.000Z",
        code: "T3EPGJKTVZPBD6Z9",
        state: "ArrangingPayment",
        active: true,
        customer: new Customer({
            id: "3",
            firstName: "Simon",
            lastName: "Test",
            emailAddress: "simon@test.com",
        }),
        lines: [
            new OrderLine({
                id: "5",
                featuredAsset: {
                    preview: "mailbox/placeholder.jpg",
                },
                productVariant: new ProductVariant({
                    id: "2",
                    name: "Ticket Werktags | G",
                    sku: "C24F390",
                    product: new Product({
                        id: "1",
                        name: "Ticket Werktags",
                    }),
                }),
                quantity: 1,
                listPrice: 15000,
                listPriceIncludesTax: true,
                adjustments: [
                    {
                        adjustmentSource: "Promotion:1",
                        type: AdjustmentType.PROMOTION,
                        amount: -1000 as any,
                        description: "Hantha 12345",
                    },
                ],
                taxLines: [],
                customFields: {
                    voucher: {
                        lang: "de",
                        salutation: "Hallo",
                        message: "Gutschein",
                        image: "",
                    }
                }
            }),
            new OrderLine({
                id: "6",
                featuredAsset: {
                    preview: "mailbox/placeholder.jpg",
                },
                productVariant: new ProductVariant({
                    id: "4",
                    name: "Hydra Serum | 30ml",
                    sku: "asdyc1",
                    product: new Product({
                        id: "2",
                        name: "Hydra Serum",
                    }),
                }),
                quantity: 3,
                listPrice: 1500,
                listPriceIncludesTax: true,
                adjustments: [],
                taxLines: [],
            }),
        ],
        subTotal: 15405,
        subTotalWithTax: 19500,
        shipping: 1000,
        shippingLines: [
            new ShippingLine({
                listPrice: 1000,
                listPriceIncludesTax: true,
                taxLines: [{ taxRate: 21, description: "shipping tax" }],
                shippingMethod: {
                    code: "express-flat-rate",
                    name: "Express Shipping",
                    description: "Express Shipping",
                    id: "2",
                },
            }),
        ],
        surcharges: [
            new Surcharge({
                description: "Bearbeitungsgebühren | für 2 Tickets",
                sku: "HANDLING_FEE",
                listPrice: 200,
                listPriceIncludesTax: true,
                taxLines: [],
            }),
        ],
        billingAddress: {
            fullName: "Mike Test",
            company: "Mike GmbH",
            streetLine1: "Zone 3/B",
            streetLine2: "2. Stock",
            city: "Lana",
            province: "BZ",
            postalCode: "39011",
            country: "Italien",
            phoneNumber: "+39 0471 123 456",
        },
        shippingAddress: {
            fullName: "Simon Test",
            company: "hantha GmbH",
            streetLine1: "Gewerbezone Dick 48/B",
            streetLine2: "3. Stock",
            city: "Sarntal",
            province: "BZ",
            postalCode: "39058",
            country: "Italien",
            phoneNumber: "+39 0471 623 721",
        },
        payments: [
            new CustomPayment({
                method: "CARD",
                paymentMethod: new PaymentMethod({
                    name: "Karte",
                }),
            }),
        ],
    })
)
