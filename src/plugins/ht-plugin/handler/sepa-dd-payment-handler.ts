import { LanguageCode } from "@vendure/common/lib/generated-types"
import { CreatePaymentResult, Customer, EntityHydrator, idsAreEqual, Order, PaymentMethodHandler, RequestContext } from "@vendure/core"
import { encryptField, last4 } from "../util/field-crypto"
import { isValidBic, isValidIban, normalizeBic, normalizeIban } from "../util/sepa-validation"
import { CustomerSepaService } from "../entities/customer/customer-sepa.service"

export const SEPA_DD_PAYMENT_CODE = "sepa-direct-debit"

let customerSepaService: CustomerSepaService
let entityHydrator: EntityHydrator

const declined = (amount: number, errorMessage: string): CreatePaymentResult => ({
    amount,
    state: "Declined" as const,
    metadata: { errorMessage },
})

/**
 * The customer whose stored mandate this payment may read or write. In the Admin API that is the
 * order's customer: an admin adding a payment to an order already needs UpdateOrder on it.
 */
const resolveMandateCustomer = async (ctx: RequestContext, order: Order): Promise<Customer | undefined> => {
    // `order.customer` is not guaranteed to be loaded here.
    await entityHydrator.hydrate(ctx, order, { relations: ["customer"] })
    if (ctx.apiType === "admin") return order.customer ?? undefined

    // Shop API: `order.customer` alone is no proof of ownership, since a guest order acquires a
    // customer through `setCustomerForOrder`. Both the session and the order must point at it.
    const customer = await customerSepaService.getOwnedCustomer(ctx)
    if (!customer || !order.customer || !idsAreEqual(customer.id, order.customer.id)) return undefined
    return customer
}

/**
 * Resolves the stored mandate for the `useSavedMandate` path.
 *
 * The ciphertext is returned untouched rather than decrypted and re-encrypted, so no plaintext
 * IBAN ever enters process memory on this path.
 */
const resolveSavedMandate = async (ctx: RequestContext, order: Order): Promise<{ accountHolderEnc: string; ibanEnc: string; bic: string; bankName: string; ibanLast4: string } | null> => {
    const customer = await resolveMandateCustomer(ctx, order)
    if (!customer) return null

    const cf = customer.customFields
    if (!cf?.sepaIbanEnc || !cf.sepaAccountHolderEnc) return null

    return {
        accountHolderEnc: cf.sepaAccountHolderEnc,
        ibanEnc: cf.sepaIbanEnc,
        bic: cf.sepaBic ?? "",
        bankName: cf.sepaBankName ?? "",
        ibanLast4: cf.sepaIbanLast4 ?? "",
    }
}

export const sepaDirectDebitPaymentHandler = new PaymentMethodHandler({
    code: SEPA_DD_PAYMENT_CODE,
    description: [
        { languageCode: LanguageCode.en, value: "SEPA Direct Debit — IBAN is collected at checkout and debited manually by an administrator." },
        { languageCode: LanguageCode.de, value: "SEPA-Lastschrift — die IBAN wird im Checkout erfasst und manuell durch einen Administrator eingezogen." },
        { languageCode: LanguageCode.it, value: "Addebito diretto SEPA — l'IBAN viene raccolto al checkout e addebitato manualmente da un amministratore." },
    ],
    args: {},
    init: (injector) => {
        customerSepaService = injector.get(CustomerSepaService)
        entityHydrator = injector.get(EntityHydrator)
    },
    createPayment: async (ctx, order, amount, _args, metadata) => {
        const mandateAccepted = metadata.mandateAccepted === true
        if (!mandateAccepted) {
            return declined(amount, "SEPA mandate not accepted")
        }

        const mandateReference = `SEPA-${order.code}-${Date.now().toString(36).toUpperCase()}`
        const mandateAcceptedAt = new Date().toISOString()

        // Reuse path: pay with the mandate stored on the customer's account.
        if (metadata.useSavedMandate === true) {
            const saved = await resolveSavedMandate(ctx, order)
            if (!saved) {
                return declined(amount, "No saved SEPA mandate")
            }
            return {
                amount,
                state: "Authorized" as const,
                transactionId: mandateReference,
                metadata: {
                    public: {
                        bic: saved.bic,
                        bankName: saved.bankName,
                        ibanLast4: saved.ibanLast4,
                        mandateReference,
                        mandateAcceptedAt,
                    },
                    accountHolderEnc: saved.accountHolderEnc,
                    ibanEnc: saved.ibanEnc,
                    encVersion: 1,
                },
            }
        }

        // Entry path: details typed at checkout.
        const accountHolder = typeof metadata.accountHolder === "string" ? metadata.accountHolder.trim() : ""
        const ibanRaw = typeof metadata.iban === "string" ? normalizeIban(metadata.iban) : ""
        const bicRaw = typeof metadata.bic === "string" ? normalizeBic(metadata.bic) : ""
        const bankName = typeof metadata.bankName === "string" ? metadata.bankName.trim() : ""

        if (!accountHolder || !bankName) {
            return declined(amount, "Missing account holder or bank name")
        }
        if (!isValidIban(ibanRaw)) {
            return declined(amount, "Invalid IBAN")
        }
        if (!isValidBic(bicRaw)) {
            return declined(amount, "Invalid BIC")
        }

        // Only reached once the payment is certain to be authorized, and inside addPaymentToOrder's
        // transaction — so a rollback un-saves the mandate and a decline never saves at all.
        if (metadata.rememberMandate === true) {
            const customer = await resolveMandateCustomer(ctx, order)
            if (customer) {
                await customerSepaService.saveMandate(ctx, customer.id, { accountHolder, iban: ibanRaw, bic: bicRaw, bankName })
            }
        }

        return {
            amount,
            state: "Authorized" as const,
            transactionId: mandateReference,
            metadata: {
                // Public (safe to expose on shop & admin APIs)
                public: {
                    bic: bicRaw,
                    bankName,
                    ibanLast4: last4(ibanRaw),
                    mandateReference,
                    mandateAcceptedAt,
                },
                // Encrypted (only reveal via admin mutation)
                accountHolderEnc: encryptField(accountHolder),
                ibanEnc: encryptField(ibanRaw),
                encVersion: 1,
            },
        }
    },
    settlePayment: async () => {
        return { success: true }
    },
    cancelPayment: async () => {
        return {
            success: true,
            metadata: { cancellationDate: new Date().toISOString() },
        }
    },
})
