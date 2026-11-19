import gql from "graphql-tag"

export const tandemShopApiExtensions = gql`
    enum VoucherCheckStatus {
        VALID
        USED
        EXPIRED
        NOT_FOUND
    }

    type VoucherCheckResult {
        code: String!
        status: VoucherCheckStatus!
        validFrom: DateTime
        validUntil: DateTime
        "Product name in the language of the request (languageCode query param), null for vouchers without product"
        productName: String
    }

    extend type Query {
        "Public voucher check for the /qr page. Rate limited per client IP. No personal data."
        checkVoucher(code: String!): VoucherCheckResult!
    }
`
