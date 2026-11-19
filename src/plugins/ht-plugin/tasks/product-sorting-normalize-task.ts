import { ScheduledTask, RequestContextService, ProductService, Logger, ProductVariantService, ID, PaginatedList } from "@vendure/core"
import { SortOrder } from "@vendure/common/lib/generated-types"
import { loggerCtx } from "../constants"

const SORTING_GAP = 100
const PAGE_SIZE = 100

type SortingRow = { id: ID; sorting: number }

/** Loads id + sorting of every entity. Pages in id order, so no row is skipped or read twice. */
async function loadSortingRows(fetchPage: (skip: number, take: number) => Promise<PaginatedList<{ id: ID; customFields?: { sorting?: number | null } }>>): Promise<SortingRow[]> {
    const rows: SortingRow[] = []
    for (let skip = 0; ; skip += PAGE_SIZE) {
        const page = await fetchPage(skip, PAGE_SIZE)
        rows.push(...page.items.map((item) => ({ id: item.id, sorting: item.customFields?.sorting ?? 0 })))
        if (!page.items.length || skip + PAGE_SIZE >= page.totalItems) {
            return rows
        }
    }
}

/**
 * Orders the whole list by its current sorting (ties by id) and spaces it SORTING_GAP apart, so the
 * dashboard's up/down buttons (neighbor ± 1) always find room. Returns only the rows whose value changes.
 * The list has to be complete - normalizing page by page gives every page the same values.
 */
function getSortingChanges(rows: SortingRow[]): SortingRow[] {
    return [...rows]
        .sort((a, b) => a.sorting - b.sorting || String(a.id).localeCompare(String(b.id), undefined, { numeric: true }))
        .map((row, index) => ({ row, sorting: (index + 1) * SORTING_GAP }))
        .filter(({ row, sorting }) => row.sorting !== sorting)
        .map(({ row, sorting }) => ({ id: row.id, sorting }))
}

export const productSortingNormalizeTask = new ScheduledTask({
    // Give your task a unique ID
    id: "product-sorting-normalize",
    // A human-readable description of the task
    description: "Normalizes product and productVariant sorting values",
    // Params can be used to further configure aspects of the
    // task. They get passed in to the `execute` function as the
    // second argument.
    // They can be later modified using the `.configure()` method on the instance
    params: {
        // shopBaseUrl: "https://www.myshop.com",
    },
    // Define a default schedule. This can be modified using the
    // `.configure()` method on the instance later.
    schedule: (cron) => cron.everyDayAt(3, 0),
    // This is the function that will be executed per the schedule.
    async execute({ injector }) {
        const ctx = await injector.get(RequestContextService).create({ apiType: "admin" })
        const productService = injector.get(ProductService)
        const productVariantService = injector.get(ProductVariantService)

        try {
            Logger.info("Starting product sorting normalization task", loggerCtx)
            const rows = await loadSortingRows((skip, take) => productService.findAll(ctx, { skip, take, sort: { id: SortOrder.ASC } }))
            const changes = getSortingChanges(rows)
            for (const { id, sorting } of changes) {
                await productService.update(ctx, { id, customFields: { sorting } })
            }
            Logger.info(`Finished product sorting normalization task: ${changes.length} of ${rows.length} products updated`, loggerCtx)
        } catch (error) {
            Logger.error(`Error normalizing product sorting values: ${(error as Error)?.message}`, loggerCtx, (error as Error)?.stack)
        }
        try {
            Logger.info("Starting productVariant sorting normalization task", loggerCtx)
            const rows = await loadSortingRows((skip, take) => productVariantService.findAll(ctx, { skip, take, sort: { id: SortOrder.ASC } }))
            const changes = getSortingChanges(rows)
            // update() takes a list and publishes one ProductVariantEvent per call, so batch it
            for (let i = 0; i < changes.length; i += PAGE_SIZE) {
                await productVariantService.update(
                    ctx,
                    changes.slice(i, i + PAGE_SIZE).map(({ id, sorting }) => ({ id, customFields: { sorting } }))
                )
            }
            Logger.info(`Finished productVariant sorting normalization task: ${changes.length} of ${rows.length} variants updated`, loggerCtx)
        } catch (error) {
            Logger.error(`Error normalizing productVariant sorting values: ${(error as Error)?.message}`, loggerCtx, (error as Error)?.stack)
        }
    },
})
