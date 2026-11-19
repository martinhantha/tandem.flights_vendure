import { LogicalOperator, ProductFilterParameter } from "@vendure/common/lib/generated-types"
import { ID, PaginatedList } from "@vendure/common/lib/shared-types"
import { ListQueryOptions, Logger, Product, ProductService, RelationPaths, RequestContext, TransactionalConnection, Translated } from "@vendure/core"
import { loggerCtx } from "../constants"

/**
 * Faster admin product list search for shops with many products (ported from spinnradl.it).
 *
 * The dashboard searches products with `name/slug/sku contains <term>` combined with OR. Vendure's default
 * ProductService.findAll joins all variants for the sku filter, which together with the OR filter ends in
 * full table scans and can exhaust the DB pool. Here the matching product ids are found with plain
 * EXISTS subqueries first, then exactly these products are loaded through the original findAll.
 *
 * Only pure text searches are handled (only `contains` on name/slug/sku, sorted by updatedAt or not at all),
 * everything else goes to Vendure unchanged.
 *
 * ProductService.prototype.findAll is replaced (instead of a DI override), because the admin resolvers use the
 * core ProductService instance.
 */

type TextSearchField = "name" | "slug" | "sku"
type ProductFindAllFn = (ctx: RequestContext, options?: ListQueryOptions<Product>, relations?: RelationPaths<Product>) => Promise<PaginatedList<Translated<Product>>>

const TEXT_FIELDS: TextSearchField[] = ["name", "slug", "sku"]

let originalFindAll: ProductFindAllFn | null = null

export function patchProductServiceFindAll(connection: TransactionalConnection): void {
    if (originalFindAll) return
    const original = ProductService.prototype.findAll as ProductFindAllFn
    originalFindAll = original

    ProductService.prototype.findAll = async function (this: ProductService, ctx, options, relations) {
        const textFields = getOptimizableTextFields(options)
        if (!textFields) {
            return original.call(this, ctx, options, relations)
        }
        return findAllByTextSearch(this, connection, textFields, ctx, options!, relations)
    } as ProductFindAllFn

    Logger.info("ProductService.findAll patched for optimized admin text search", loggerCtx)
}

/** Returns the text fields to search, or null if the default Vendure query should be used. */
function getOptimizableTextFields(options?: ListQueryOptions<Product>): TextSearchField[] | null {
    const filter = options?.filter as ProductFilterParameter | undefined
    if (!filter) return null

    // only pure text searches: any other filter (enabled, facets, _and/_or, ...) → default query
    const filterKeys = Object.keys(filter).filter((key) => (filter as any)[key] != null)
    if (filterKeys.some((key) => !TEXT_FIELDS.includes(key as TextSearchField))) return null

    const fields: TextSearchField[] = []
    for (const field of TEXT_FIELDS) {
        const operators = filter[field]
        if (!operators) continue
        const operatorKeys = Object.keys(operators).filter((key) => (operators as any)[key] != null)
        if (operatorKeys.length !== 1 || typeof operators.contains !== "string" || operators.contains.length === 0) return null
        fields.push(field)
    }
    if (fields.length === 0) return null

    // custom sorting (name, price, ...) → default query
    const sortKeys = Object.keys(options?.sort ?? {}).filter((key) => (options!.sort as any)[key] != null)
    if (sortKeys.some((key) => key !== "updatedAt")) return null

    // sku `contains` forces a join on all product variants in Vendure's default query
    if (fields.includes("sku")) return fields

    // dashboard search sends name + slug (+ sku) with OR
    return options?.filterOperator === LogicalOperator.OR && fields.length >= 2 ? fields : null
}

async function findAllByTextSearch(
    service: ProductService,
    connection: TransactionalConnection,
    textFields: TextSearchField[],
    ctx: RequestContext,
    options: ListQueryOptions<Product>,
    relations?: RelationPaths<Product>,
): Promise<PaginatedList<Translated<Product>>> {
    const filter = options.filter as ProductFilterParameter
    const filterOperator = options.filterOperator ?? LogicalOperator.AND
    const skip = options.skip ?? 0
    const take = options.take ?? 50
    const sortUpdatedAt = options.sort?.updatedAt === "ASC" ? "ASC" : "DESC"

    const conditions: string[] = []
    const params: Record<string, string> = {}

    if (textFields.includes("name")) {
        conditions.push(`EXISTS (SELECT 1 FROM product_translation pt WHERE pt."baseId" = product.id AND pt.name ILIKE :nameTerm)`)
        params.nameTerm = `%${filter.name!.contains}%`
    }
    if (textFields.includes("slug")) {
        conditions.push(`EXISTS (SELECT 1 FROM product_translation pt WHERE pt."baseId" = product.id AND pt.slug ILIKE :slugTerm)`)
        params.slugTerm = `%${filter.slug!.contains}%`
    }
    if (textFields.includes("sku")) {
        conditions.push(`EXISTS (SELECT 1 FROM product_variant pv WHERE pv."productId" = product.id AND pv."deletedAt" IS NULL AND pv.sku ILIKE :skuTerm)`)
        params.skuTerm = `%${filter.sku!.contains}%`
    }

    const textWhere = filterOperator === LogicalOperator.OR ? `(${conditions.join(" OR ")})` : conditions.join(" AND ")

    const baseQb = connection
        .getRepository(ctx, Product)
        .createQueryBuilder("product")
        .innerJoin("product.channels", "channel", "channel.id = :channelId", { channelId: ctx.channelId })
        .where("product.deletedAt IS NULL")
        .andWhere(textWhere, params)

    const countRow = await baseQb.clone().select("COUNT(DISTINCT product.id)", "cnt").getRawOne<{ cnt: string }>()
    const totalItems = Number(countRow?.cnt ?? 0)

    const idRows = await baseQb
        .clone()
        .select("product.id", "id")
        .groupBy("product.id")
        .addSelect("MAX(product.updatedAt)", "sort_updated_at")
        .orderBy("sort_updated_at", sortUpdatedAt)
        .offset(skip)
        .limit(take)
        .getRawMany<{ id: ID }>()

    const ids = idRows.map((row) => String(row.id))
    if (ids.length === 0) {
        return { items: [], totalItems }
    }

    const listed = await originalFindAll!.call(service, ctx, { filter: { id: { in: ids } }, take: ids.length }, relations)

    const order = new Map(ids.map((id, index) => [id, index]))
    listed.items.sort((a, b) => (order.get(String(a.id)) ?? 0) - (order.get(String(b.id)) ?? 0))

    return { items: listed.items, totalItems }
}

/**
 * Trigram indexes for the ILIKE '%term%' searches above (name, slug, sku).
 *
 * Not a migration on purpose: with `synchronize: true` (template / development) TypeORM drops indexes it does not
 * know on every start, and a migration would be marked as done anyway – after switching a project to
 * `synchronize: false` the indexes would then be missing for good. So they are created on start, only when
 * synchronize is off (live). CONCURRENTLY: no write lock on the tables while building, runs in the background.
 */
export async function ensureProductSearchIndexes(connection: TransactionalConnection): Promise<void> {
    const raw = connection.rawConnection
    if (raw.options.type !== "postgres" || raw.options.synchronize) return

    const indexes: Array<{ name: string; sql: string }> = [
        { name: "idx_product_translation_name_trgm", sql: `ON "product_translation" USING gin ("name" gin_trgm_ops)` },
        { name: "idx_product_translation_slug_trgm", sql: `ON "product_translation" USING gin ("slug" gin_trgm_ops)` },
        { name: "idx_product_variant_sku_trgm", sql: `ON "product_variant" USING gin ("sku" gin_trgm_ops) WHERE "deletedAt" IS NULL` },
        { name: "idx_variant_sku_product", sql: `ON "product_variant" ("sku", "productId") WHERE "deletedAt" IS NULL` },
    ]

    try {
        await raw.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm`)

        for (const index of indexes) {
            // an interrupted CONCURRENTLY build leaves an invalid index, which IF NOT EXISTS would skip
            const invalid = await raw.query(`SELECT 1 FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid WHERE c.relname = $1 AND NOT i.indisvalid`, [index.name])
            if (invalid.length) {
                await raw.query(`DROP INDEX CONCURRENTLY IF EXISTS "${index.name}"`)
            }
            await raw.query(`CREATE INDEX CONCURRENTLY IF NOT EXISTS "${index.name}" ${index.sql}`)
        }
        Logger.info("Product search indexes ensured", loggerCtx)
    } catch (error) {
        Logger.warn(`Product search indexes could not be created: ${(error as Error)?.message}`, loggerCtx)
    }
}
