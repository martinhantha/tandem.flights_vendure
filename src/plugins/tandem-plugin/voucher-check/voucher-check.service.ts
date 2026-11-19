import { Injectable } from "@nestjs/common"
import { ProductVariant, RequestContext, TransactionalConnection, TranslatorService } from "@vendure/core"
import { IsNull } from "typeorm"
import { Voucher } from "../../ht-plugin/entities/voucher/entity"
import { getVoucherValidity } from "../../ht-plugin/entities/voucher/service"

export type VoucherCheckStatus = "VALID" | "USED" | "EXPIRED" | "NOT_FOUND"

export interface VoucherCheckResult {
    code: string
    status: VoucherCheckStatus
    validFrom: Date | null
    validUntil: Date | null
    productName: string | null
}

/** Voucher codes are [0-9A-Za-z] (plus an optional prefix with "-"); anything else is not looked up at all. */
const CODE_PATTERN = /^[0-9A-Za-z-]{4,32}$/

/**
 * Public voucher check for the /qr page of the storefront. Returns only status, validity and the
 * product name - never the customer, order, recipient (`info`) or amount.
 */
@Injectable()
export class VoucherCheckService {
    constructor(private connection: TransactionalConnection, private translator: TranslatorService) {}

    async check(ctx: RequestContext, rawCode: string): Promise<VoucherCheckResult> {
        const code = (rawCode ?? "").trim()
        const notFound: VoucherCheckResult = { code, status: "NOT_FOUND", validFrom: null, validUntil: null, productName: null }
        if (!CODE_PATTERN.test(code)) return notFound

        const voucher = await this.findByCode(ctx, code)
        if (!voucher) return notFound

        return {
            code: voucher.code,
            status: getVoucherCheckStatus(voucher),
            validFrom: voucher.validFrom ?? null,
            validUntil: voucher.validTo ?? null,
            productName: await this.getProductName(ctx, voucher),
        }
    }

    private async findByCode(ctx: RequestContext, code: string): Promise<Voucher | null> {
        const repository = this.connection.getRepository(ctx, Voucher)
        const exact = await repository.findOne({ where: { code, deletedAt: IsNull() } })
        if (exact) return exact
        // printed codes are upper case, people may type them in lower case
        return repository
            .createQueryBuilder("voucher")
            .where("UPPER(voucher.code) = :code", { code: code.toUpperCase() })
            .andWhere("voucher.deletedAt IS NULL")
            .orderBy("voucher.id", "ASC")
            .getOne()
    }

    /** `product_id` holds the ProductVariant id of shop orders and of the imported shop vouchers. */
    private async getProductName(ctx: RequestContext, voucher: Voucher): Promise<string | null> {
        const variantId = voucher.product_id
        if (!variantId || !/^\d+$/.test(variantId)) return null
        const variant = await this.connection.getRepository(ctx, ProductVariant).findOne({
            where: { id: variantId },
            relations: ["product"],
        })
        if (!variant?.product) return null
        return this.translator.translate(variant.product, ctx).name || null
    }
}

/**
 * USED wins over EXPIRED: a redeemed voucher stays "used" after its expiry date.
 * A voucher counts as used once its balance is 0 (redeemed in the shop or set to 0 by staff via
 * "redeem on-site" in the dashboard). Imported legacy vouchers without a known value have amount null.
 */
export function getVoucherCheckStatus(voucher: Pick<Voucher, "amount" | "validFrom" | "validTo">, now?: Parameters<typeof getVoucherValidity>[1]): VoucherCheckStatus {
    if (voucher.amount !== null && voucher.amount !== undefined && voucher.amount <= 0) return "USED"
    const validity = getVoucherValidity(voucher, now)
    if (!validity.valid && validity.reason === "expired") return "EXPIRED"
    // "notYetValid" only happens for vouchers dated in the future; the storefront can show validFrom
    return "VALID"
}
