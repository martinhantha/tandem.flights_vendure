import { Injectable } from "@nestjs/common"
import { Args } from "@nestjs/graphql"
import { ListQueryBuilder, ListQueryOptions, PaginatedList, RequestContext, TransactionalConnection, ID, Customer, Logger, OrderLine, Order, CustomerService, ConfigService, GlobalSettingsService, ProductService, EventBus, UserInputError } from "@vendure/core"
import { Voucher } from "./entity"
import { loggerCtx, isCouponSku, couponCodeFromSku } from "../../constants"
import { MoreThan, Like, Not, And, IsNull } from "typeorm"
import { VoucherByOrderService } from "../../services/voucher-by-order-service"
import { TextblockService } from "../textblock/service"
import timezonedDayjs from "../../services/dayjs"
import { CustomSettingsService } from "../customSettings/service"
import { DeletionResponse, DeletionResult } from "@vendure/common/lib/generated-types"
import { randomBytes } from "crypto"

const voucherPath = process.env.SHOP_VOUCHER_PATH || "pdfs/voucher-"

export type VoucherValidity = { valid: true } | { valid: false; reason: "notYetValid" | "expired" }

/**
 * Whether the voucher may be redeemed today. `validFrom`/`validTo` are printed as dates without a
 * time, so both ends count as whole days ("Gültig bis 10.09." includes the whole 10th).
 */
export function getVoucherValidity(voucher: Pick<Voucher, "validFrom" | "validTo">, now = timezonedDayjs()): VoucherValidity {
    if (voucher.validFrom && now.isBefore(timezonedDayjs(voucher.validFrom).startOf("day"))) {
        return { valid: false, reason: "notYetValid" }
    }
    if (voucher.validTo && now.isAfter(timezonedDayjs(voucher.validTo).endOf("day"))) {
        return { valid: false, reason: "expired" }
    }
    return { valid: true }
}

@Injectable()
export class VoucherService {
    constructor(private connection: TransactionalConnection, private listQueryBuilder: ListQueryBuilder, private customerService: CustomerService, private configService: ConfigService, private customSettingsService: CustomSettingsService, private textblockService: TextblockService, private productService: ProductService, private eventBus: EventBus) { }

    findAll(ctx: RequestContext, options?: ListQueryOptions<Voucher>): Promise<PaginatedList<Voucher>> {
        return this.listQueryBuilder
            .build(Voucher, options, { relations: ["customer"], where: { deletedAt: IsNull() } })
            .getManyAndCount()
            .then(async ([items, totalItems]) => ({ items, totalItems }))
    }
    async findOne(ctx: RequestContext, id: ID): Promise<Voucher | null> {
        return await this.connection.getRepository(ctx, Voucher).findOne({
            relations: ["customer"],
            where: {
                id,
            },
        })
    }
    async findOneByCode(ctx: RequestContext, code: string): Promise<Voucher | null> {
        return await this.connection.getRepository(ctx, Voucher).findOne({
            relations: ["customer"],
            where: {
                code,
                deletedAt: IsNull(),
            },
        })
    }
    async findOneByOrder(ctx: RequestContext, order: Order, productId: string = "", i: number = -1): Promise<Voucher | null> {
        return await this.connection.getRepository(ctx, Voucher).findOne({
            relations: ["customer"],
            where: {
                order_id: "" + order.id,
                product_id: productId ? "" + productId : undefined,
                nth_product_item: i > -1 ? i : undefined,
            },
        })
    }
    async findCodesByCustomer(ctx: RequestContext): Promise<Voucher[] | null> {
        const activeUserId = ctx.activeUserId
        if (!activeUserId) {
            return null
        }
        const customer = await this.customerService.findOneByUserId(ctx, activeUserId)
        if (!customer) return null

        let vouchers = await this.connection.getRepository(ctx, Voucher).find({
            relations: ["customer"],
            where: {
                customer: {
                    id: customer.id,
                },
                // starts with letter
                createdAt: MoreThan(timezonedDayjs().subtract(1, "year").toDate()),
            },
        })
        const { assetStorageStrategy } = this.configService.assetOptions
        const currentSettings = await this.customSettingsService.findOne(ctx, { name: "voucher-template" })
        if (!currentSettings) {
            Logger.error("voucher-template not found", loggerCtx)
            return vouchers
        }
        for (const voucher of vouchers) {
            const order = await this.connection.getRepository(ctx, Order).findOne({
                where: {
                    code: voucher.order_id,
                },
                relations: ["lines", "lines.productVariant", "lines.productVariant.product"],
            })
            if (!order) continue
            const orderLine = order.lines.find((orderLine) => orderLine.id == voucher.order_line_id)
            if (!(await assetStorageStrategy.fileExists(voucherPath + voucher.code + ".pdf")) && orderLine) {
                const voucherByOrderService = new VoucherByOrderService(this.customSettingsService, this.productService, this, this.configService, this.textblockService)
                await voucherByOrderService.getVoucherByOrderLine(ctx, order, orderLine, JSON.parse(currentSettings.value ?? "{}"), assetStorageStrategy)
            }
        }

        return vouchers
    }
    async findOneByProductOrderLine(ctx: RequestContext, product_id: string, line: OrderLine, order: Order, nth_product_item: number, language: string = "de"): Promise<Voucher | null> {
        let voucher = await this.connection.getRepository(ctx, Voucher).findOne({
            relations: ["customer"],
            where: {
                product_id,
                order_line_id: "" + line.id,
                order_code: order.code,
                nth_product_item,

            },
            cache: false,
        })
        Logger.debug("VoucherService.findOneByProductOrderLine " + product_id + " " + line.id + " " + order.code + " " + nth_product_item + " " + voucher?.code + " " + voucher?.id, loggerCtx)
        if (!voucher) {
            const productVariantName = line.productVariant?.translations.find((t) => t.languageCode === language)?.name ?? ""
            let productName = line.productVariant?.product?.translations.find((t) => t.languageCode === language)?.name ?? ""
            let amount = line.productVariant?.productVariantPrices?.[0]?.price

            const name = productName ? productName : productVariantName
            voucher = await this.getNewCode(ctx, name, product_id, line.id, order, nth_product_item, order.customer, amount)
        }

        return voucher
    }
    async getNewCode(ctx: RequestContext, info: string, product_id: ID, order_line_id: ID, order: Order, nth_product_item: number, customer: Customer | undefined, amount: number): Promise<Voucher | null> {
        let code = ""
        let voucher = null
        let i = 0
        do {
            code = this.generateCouponId(process.env.SHOP_VOUCHER_CODE_PREFIX)
            voucher = await this.connection.getRepository(ctx, Voucher).findOne({
                relations: ["customer"],
                where: {
                    code,
                },
            })
            if(voucher) {
                // a random code collision, the loop retries with a new code
                Logger.warn("Voucher code already exists, generating a new one: " + code, loggerCtx)
            }
        } while (voucher && i++ < 10000)
        const newVoucher = new Voucher()
        newVoucher.code = code
        newVoucher.info = info
        newVoucher.product_id = "" + product_id
        newVoucher.order_line_id = "" + order_line_id
        newVoucher.order_id = "" + order.id
        newVoucher.order_code = "" + order.code
        newVoucher.amount = amount
        newVoucher.initialAmount = amount
        newVoucher.currencyCode = ctx.currencyCode
        newVoucher.validFrom = timezonedDayjs().toDate()
        newVoucher.validTo = timezonedDayjs().add(1, "year").toDate()
        newVoucher.path = (process.env.VOUCHER_PATH || "pdf/voucher-") + code + ".pdf"
        newVoucher.nth_product_item = nth_product_item
        if (customer) newVoucher.customer = customer

        voucher = await this.connection.getRepository(ctx, Voucher).findOne({
            where: {
                product_id: "" + product_id,
                order_line_id: "" + order_line_id,
                order_code: order.code,
                nth_product_item,
            },
            cache: false,
        })

        if (!voucher) {
            const result = await this.connection.getRepository(ctx, Voucher).save(newVoucher, { transaction: false })
            await this.connection.commitOpenTransaction(ctx)
            Logger.debug(`getNewCode created voucher ${result.code} (id ${result.id}) for order ${order.code}`, loggerCtx)
            return result
        }

        return voucher
    }
    async useVoucherByOrder(ctx: RequestContext, order: Order): Promise<boolean> {
        Logger.debug("useVoucherByOrder " + order.code + ": " + order.surcharges.length + " surcharges", "VoucherService")
        let success = true
        for (const surcharge of order.surcharges) {
            if (isCouponSku(surcharge.sku)) {
                const code = couponCodeFromSku(surcharge.sku)
                const voucher = await this.connection.getRepository(ctx, Voucher).findOne({
                    where: {
                        code,
                        deletedAt: IsNull(),
                    },
                })
                if (!voucher) {
                    Logger.error("order " + order.code + " redeems unknown voucher code " + code, "VoucherService")
                    success = false
                } else {
                    // one failing voucher must not keep the others from being deducted
                    try {
                        await this.useVoucher(ctx, voucher.id, surcharge.listPrice)
                        Logger.debug("used voucher " + voucher.code + " for order " + order.code, "VoucherService")
                    } catch (error) {
                        Logger.error("could not use voucher " + voucher.code + " for order " + order.code + ": " + (error as Error)?.message, "VoucherService")
                        success = false
                    }
                }
            }
        }
        return success
    }
    /**
     * Takes `amount` off the voucher's balance. The order passes the surcharge `listPrice` (negative, it lowers the
     * order total), the admin mutation a positive amount - both mean "use this much", so the sign is ignored.
     */
    async useVoucher(ctx: RequestContext, id: ID, amount: number): Promise<Voucher> {
        const voucher = await this.connection.getEntityOrThrow(ctx, Voucher, id)
        const debit = Math.abs(amount ?? 0)
        if (!debit) throw new UserInputError("Voucher amount to use is 0", {
            code: "VOUCHER_AMOUNT_TO_USE_IS_0",
        })
        if (voucher.amount <= 0) throw new UserInputError("Voucher amount is 0", {
            code: "VOUCHER_AMOUNT_IS_0",
        })
        if (voucher.amount < debit) throw new UserInputError("Voucher amount is less than the amount to use", {
            code: "VOUCHER_AMOUNT_LESS_THAN_AMOUNT_TO_USE",
        })
        voucher.amount -= debit

        await this.connection.getRepository(ctx, Voucher).save(voucher, { reload: false })
        return voucher
    }
    async deleteVoucher(ctx: RequestContext, id: ID): Promise<DeletionResponse> {
        const voucher = await this.connection.getEntityOrThrow(ctx, Voucher, id)
        
        voucher.deletedAt = new Date()
        await this.connection.getRepository(ctx, Voucher).save(voucher, { reload: false })
        return { result: DeletionResult.DELETED, message: "Voucher deleted" }
    }
    async createVoucher(ctx: RequestContext, input: any) {
        const voucher = new Voucher(input)
        const result = await this.connection.getRepository(ctx, Voucher).save(voucher)
        return result
    }
    async updateVoucher(ctx: RequestContext, input: any) {
        const voucher = await this.connection.getEntityOrThrow(ctx, Voucher, input.id)
        voucher.code = input.code
        voucher.amount = input.amount   
        voucher.initialAmount = input.initialAmount
        voucher.validFrom = (input.validFrom ? timezonedDayjs(input.validFrom).toDate() : null) as any
        voucher.validTo = (input.validTo ? timezonedDayjs(input.validTo).toDate() : null) as any
        voucher.info = input.info
        voucher.customer = (input.customerId ? await this.customerService.findOne(ctx, input.customerId) : null) as any
        
        await this.connection.getRepository(ctx, Voucher).save(voucher)
        return voucher
    }
    protected generateCouponId(precode: string = ""): string {
        // SHOP_VOUCHER_CODE_LENGTH: number of random [0-9A-Z] characters after the prefix (tandem.flights: 8, like the old TYPO3 shop)
        const length = parseInt(process.env.SHOP_VOUCHER_CODE_LENGTH ?? "", 10)
        if (length > 0) {
            const alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"
            let random = ""
            for (const byte of randomBytes(length)) {
                // byte % 36 has a slight modulo bias, negligible for voucher codes
                random += alphabet[byte % alphabet.length]
            }
            return precode + random
        }
        const count = 5
        return (
            precode +
            Math.random().toString(36).substring(2, count) +
            Math.random()
                .toString(36)
                .substring(2, count + 1)
        ).toUpperCase()
    }
    async ckeckAndCreateVoucherPdf(ctx: RequestContext, id: ID): Promise<boolean> {
        if (!id) return false

        const order = await this.connection.getRepository(ctx, Order).findOne({
            where: {
                id,
            },
            relations: ["lines", "payments", "fulfillments", "lines.productVariant", "lines.productVariant.product", "lines.productVariant.facetValues", "lines.productVariant.facetValues.facet"],
        })

        if (!order) return false
        for (const line of order.lines) {
            for (let i = 0; i < line.quantity; i++) {
                this.findOneByProductOrderLine(ctx, "" + line.productVariant.id, line, order, i).then(async (voucher) => {
                    if (!voucher) return
                    const { assetStorageStrategy } = this.configService.assetOptions
                    const currentSettings = await this.customSettingsService.findOne(ctx, { name: "voucher-template" })
                    if (!currentSettings) {
                        Logger.error("voucher-template not found", loggerCtx)
                        return false
                    }
                    if (!(await assetStorageStrategy.fileExists(voucherPath + voucher.code + ".pdf")) && line) {
                        const voucherByOrderService = new VoucherByOrderService(this.customSettingsService, this.productService, this, this.configService, this.textblockService)
                        await voucherByOrderService.getVoucherByOrderLine(ctx, order, line, JSON.parse(currentSettings.value ?? "{}"), assetStorageStrategy)
                    }
                })
            }
        }
        return false
    }
}
