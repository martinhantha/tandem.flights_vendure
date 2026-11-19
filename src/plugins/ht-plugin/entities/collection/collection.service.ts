import { Injectable } from "@nestjs/common"
import { Product, ID, ListQueryBuilder, RequestContext } from "@vendure/core"

@Injectable()
export class MyCollectionService {
    constructor(private listQueryBuilder: ListQueryBuilder) {}

    async getProductsForCollection(ctx: RequestContext, collectionId: ID, options: any): Promise<{ items: Product[]; totalItems: number }> {
        const qb = this.listQueryBuilder.build(
            Product,
            {},
            {
                relations: [
                    "variants",
                    "variants.collections",
                    "featuredAsset", // Falls du Bilder brauchst
                    "translations", // Falls du Übersetzungen brauchst
                ],
                channelId: ctx.channelId,
                ctx,
            },
        )

        const alias = qb.alias // Ermittelt den Alias für Product

        // Joins für Varianten und Collections setzen
        qb.innerJoin(`${alias}.variants`, "variants", "variants.deletedAt IS NULL").innerJoin("variants.collections", "collections").where("collections.id = :collectionId", { collectionId }).andWhere(`${alias}.deletedAt IS NULL`)

        const [products, total] = await qb.getManyAndCount()

        // Pagination direkt auf Produkte anwenden
        if (options?.take) {
            const skip = options?.skip ?? 0
            const paginatedProducts = products.slice(skip, skip + options.take)
            return {
                items: paginatedProducts,
                totalItems: total,
            }
        } else
            return {
                items: products,
                totalItems: total,
            }
    }
}
