import { Injectable } from "@nestjs/common"
import { Customer, CustomerService, Logger, RequestContext, TransactionalConnection } from "@vendure/core"
import { loggerCtx } from "../../constants"
import { decryptField, encryptField, last4, maskIban } from "../../util/field-crypto"
import { normalizeBic, normalizeIban } from "../../util/sepa-validation"

export interface SavedSepaMandate {
    accountHolder: string
    ibanMasked: string
    ibanLast4: string
    bic: string
    bankName: string
    savedAt: Date | null
}

export interface SepaMandateInput {
    accountHolder: string
    iban: string
    bic: string
    bankName: string
}

/**
 * Owns the SEPA mandate a customer has stored for reuse. Shared by the shop resolver and the
 * SEPA payment handler so the ownership and encryption rules live in exactly one place.
 */
@Injectable()
export class CustomerSepaService {
    constructor(private connection: TransactionalConnection, private customerService: CustomerService) {}

    /**
     * The customer behind the current session, or undefined for a guest. Identity is taken from
     * `ctx.activeUserId` only — never from an id supplied by the client or from `order.customer`,
     * which a guest order acquires through `setCustomerForOrder`.
     */
    async getOwnedCustomer(ctx: RequestContext): Promise<Customer | undefined> {
        if (!ctx.activeUserId) return undefined
        return (await this.customerService.findOneByUserId(ctx, ctx.activeUserId)) ?? undefined
    }

    /**
     * The masked view for the storefront. Only the account holder is decrypted — the IBAN is read
     * from the stored mask, so no shop path ever holds a plaintext IBAN.
     */
    getSavedMandate(customer: Customer): SavedSepaMandate | null {
        const cf = customer.customFields
        if (!cf?.sepaIbanEnc || !cf.sepaIbanMasked || !cf.sepaAccountHolderEnc) return null
        let accountHolder: string
        try {
            accountHolder = decryptField(cf.sepaAccountHolderEnc)
        } catch {
            // A missing or rotated key must degrade to "nothing saved" rather than break checkout.
            Logger.warn(`Could not decrypt stored SEPA account holder for customer ${customer.id}`, loggerCtx)
            return null
        }
        return {
            accountHolder,
            ibanMasked: cf.sepaIbanMasked,
            ibanLast4: cf.sepaIbanLast4 ?? "",
            bic: cf.sepaBic ?? "",
            bankName: cf.sepaBankName ?? "",
            savedAt: cf.sepaSavedAt ?? null,
        }
    }

    async saveMandate(ctx: RequestContext, customerId: Customer["id"], input: SepaMandateInput): Promise<void> {
        const iban = normalizeIban(input.iban)
        const repo = this.connection.getRepository(ctx, Customer)
        const customer = await repo.findOne({ where: { id: customerId } })
        if (!customer) return
        // Written through the repository rather than CustomerService.update because readonly and
        // internal fields are stripped from UpdateCustomerInput.
        customer.customFields.sepaAccountHolderEnc = encryptField(input.accountHolder.trim())
        customer.customFields.sepaIbanEnc = encryptField(iban)
        customer.customFields.sepaIbanMasked = maskIban(iban)
        customer.customFields.sepaIbanLast4 = last4(iban)
        customer.customFields.sepaBic = normalizeBic(input.bic)
        customer.customFields.sepaBankName = input.bankName.trim()
        customer.customFields.sepaSavedAt = new Date()
        await repo.save(customer, { reload: false })
    }

    async deleteMandate(ctx: RequestContext, customerId: Customer["id"]): Promise<boolean> {
        const repo = this.connection.getRepository(ctx, Customer)
        const customer = await repo.findOne({ where: { id: customerId } })
        if (!customer) return false
        customer.customFields.sepaAccountHolderEnc = null
        customer.customFields.sepaIbanEnc = null
        customer.customFields.sepaIbanMasked = null
        customer.customFields.sepaIbanLast4 = null
        customer.customFields.sepaBic = null
        customer.customFields.sepaBankName = null
        customer.customFields.sepaSavedAt = null
        await repo.save(customer, { reload: false })
        return true
    }
}
