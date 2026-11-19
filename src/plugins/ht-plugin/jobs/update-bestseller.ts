import { Injectable, OnModuleInit } from "@nestjs/common"
import { RequestContext, GlobalSettingsService, JobQueue, JobQueueService, ChannelService, Logger, TransactionalConnection, ProductVariant, Product } from "@vendure/core"
import timezonedDayjs from "../services/dayjs"
import { loggerCtx } from "./constants"
import { Bestseller } from "../entities/bestseller/entity"

@Injectable()
export class UpdateBestsellerService implements OnModuleInit {
    private jobQueue: JobQueue<{}>

    constructor(private connection: TransactionalConnection, private jobQueueService: JobQueueService, private channelService: ChannelService) {}

    async onModuleInit() {
        this.jobQueue = await this.jobQueueService.createQueue({
            name: "update-bestseller",
            process: async (job: any) => {
                try {
                    Logger.debug("Update Bestseller Module process", loggerCtx)

                    // const defaultChannel = await this.channelService.getDefaultChannel()
                    // if (!defaultChannel) {
                    //     throw new Error("Default channel not found")
                    // }
                    // const ctx = new RequestContext({
                    //     apiType: "admin",
                    //     channel: defaultChannel,
                    //     authorizedAsOwnerOnly: false,
                    //     isAuthorized: true,
                    // })
                    // awaited, otherwise a failing query never reaches the catch below
                    await this.updateBestSellerQuery()
                } catch (error) {
                    Logger.error(`Update bestseller failed: ${(error as Error)?.message}`, loggerCtx, (error as Error)?.stack)
                }
            },
        })
    }
    updateBestseller(item: any) {
        return this.jobQueue.add(item, { retries: 2 })
    }
    async updateBestSellerQuery() {
        const dateFrom = timezonedDayjs().year(2025).date(26).month(2).hour(0).minute(0).second(0).millisecond(0).toDate(),
            toDate = timezonedDayjs().hour(0).minute(0).second(0).millisecond(0).subtract(0, "day").toDate()
        // every day from dateFrom to dateTo
        
        for (let i = dateFrom.getTime(); i <= toDate.getTime(); i += 24 * 60 * 60 * 1000) {
            const date = new Date(i)
            await this.updateBestsellerByDate(date)
        }
        // const date = timezonedDayjs().hour(0).minute(0).second(0).millisecond(0).subtract(1, "day").toDate()
        // await this.updateBestsellerByDate(date)
    }
    async updateBestsellerByDate(date: Date) {
        const query = `
        SELECT ol."productVariantId",
            ol."listPrice",
            ol.adjustments,
            ol.id as orderlineid,
            SUM(ol."quantity") AS total_quantity,
            COUNT(ol."productVariantId") AS total_sales
        FROM order_line ol
        JOIN "order" o ON ol."orderId" = o.id
        WHERE (o.state = 'PaymentSettled' OR o.state = 'Delivered' OR o.state = 'Shipped')
        AND o."orderPlacedAt" >= CAST($1 AS TIMESTAMP) 
        AND o."orderPlacedAt" < CAST($1 AS TIMESTAMP) + INTERVAL '1 day'
        GROUP BY ol."productVariantId", ol.id, ol."listPrice", ol.adjustments
        ORDER BY total_sales DESC;

    `
        const formattedDate = date.toISOString() // Format date as ISO string
        const result = await this.connection.rawConnection.query(query, [formattedDate])

        const repo = this.connection.getRepository(Bestseller)
        const repoPV = this.connection.getRepository(ProductVariant)
        const repoP = this.connection.getRepository(Product)

        for (const row of result) {
            let price = row.listPrice
            if (row.adjustments) {
                const adjustments = JSON.parse(row.adjustments)
                for (const adjustment of adjustments) {
                    // Order-level promotions spread their amount via data.itemDistribution; line-level ones
                    // (e.g. manualLineDiscount) carry none, so fall back to the adjustment's own amount.
                    const share = adjustment?.data?.itemDistribution?.[0]
                    if (typeof share === "number") {
                        price += share
                    } else if (typeof adjustment?.amount === "number") {
                        price += adjustment.amount
                    }
                }
            }
            const existing = await repo.findOne({
                where: {
                    productVariantId: row.productVariantId,
                    date,
                    price: price,
                },
            })

            if (existing?.orderlineIds.find((item) => item === "" + row.orderlineid)) {
                // Skip if the record was already updated today
                continue
            }

            if (existing) {
                // Update existing record
                existing.totalSales += +row.total_quantity
                existing.orderlineIds.push(row.orderlineid)
                await repo.save(existing)
            } else {
                // Insert new bestseller
                const newBestSeller = new Bestseller()
                newBestSeller.productVariantId = row.productVariantId
                newBestSeller.totalSales = row.total_quantity
                newBestSeller.price = price
                newBestSeller.date = date
                newBestSeller.orderlineIds = [row.orderlineid]
                await repo.save(newBestSeller)
            }
            const item = await repoPV.findOne({
                where: {
                    id: row.productVariantId,
                },
                relations: ["product"],
            })

            if (item) {
                await repoPV.update(row.productVariantId, {
                    customFields: {
                        sold: item.customFields.sold ? item?.customFields.sold + parseInt(row.total_quantity) : +row.total_quantity,
                    },
                })

                await repoP.update(item.product.id, {
                    customFields: {
                        sold: item.product.customFields.sold ? item.product.customFields.sold + parseInt(row.total_quantity) : +row.total_quantity,
                    },
                })
            }
        }
    }
}
