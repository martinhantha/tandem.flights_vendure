import { ListQueryBuilder, ListQueryOptions, PaginatedList, RequestContext, TransactionalConnection, ID, Product, ProductVariant } from "@vendure/core"
import { Injectable } from "@nestjs/common"
import { Bestseller } from "./entity"

@Injectable()
export class BestsellerService {
    constructor(private connection: TransactionalConnection, private listQueryBuilder: ListQueryBuilder) {}

    async findAll(ctx: RequestContext, options?: ListQueryOptions<Bestseller>): Promise<PaginatedList<Bestseller>> {
        const query = this.listQueryBuilder.build(Bestseller, options, {
            ctx,
            relations: ["productVariant", "productVariant.product"],
        })
        return query.getManyAndCount().then(([items, totalItems]) => {
            return {
                items,
                totalItems,
            }
        })
    }

    async findOne(ctx: RequestContext, id: ID): Promise<Bestseller | null> {
        return this.connection.getRepository(ctx, Bestseller).findOne({
            where: {
                id,
            },
        })
    }
    async findAllProducts(ctx: RequestContext, options?: any): Promise<PaginatedList<Product>> {
        const query = this.listQueryBuilder.build(
            Product,
            options,
            {
                ctx,
                relations: ["variants"],
            }
        )
        return query.getManyAndCount().then(([items, totalItems]) => {
            return {
                items,
                totalItems,
            }
        })
    }
    async findBestsellerMap(ctx: RequestContext, options?: any): Promise<PaginatedList<Bestseller>> {
        const query = this.listQueryBuilder.build(
            Bestseller,
            { filter: options.filter },
            {
                ctx,
                relations: ["productVariant", "productVariant.product"],
            }
        )
        // can i get the elements and reduce them to the month?
        return query.getManyAndCount().then(([items, totalItems]) => {
            const itemsGrouped = new Map<ID, Bestseller>()
            // group by month
            for (const item of items) {
                const productId = item.productVariantId
                if (itemsGrouped.has(productId)) {
                    itemsGrouped.get(productId)!.totalSales += item.totalSales
                } else {
                    itemsGrouped.set(productId, item)
                }
            }

            return {
                items: Array.from(itemsGrouped.values()).sort((a, b) => {
                    if (options.sort?.totalSales) {
                        if (options.sort.totalSales === "ASC") {
                            return a.totalSales - b.totalSales
                        }
                        return b.totalSales - a.totalSales
                    }
                    if (options.sort?.date) {
                        if (options.sort.date === "ASC") {
                            return a.date.getTime() - b.date.getTime()
                        }
                        return b.date.getTime() - a.date.getTime()
                    }
                    return 0
                }),
                totalItems: itemsGrouped.size,
            }
        })
    }
}
