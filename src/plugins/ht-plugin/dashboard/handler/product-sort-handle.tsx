import { Button as VendureButton, Input, PaginatedListContext, api, graphql, useMutation, useQueryClient, toast } from "@vendure/dashboard"
const ActionButton: any = VendureButton
import type { DataDisplayComponentProps } from "@vendure/dashboard"
import type { CellContext } from "@tanstack/table-core"
import { useContext, useEffect, useMemo, useState, type ChangeEvent, type KeyboardEvent } from "react"
import { UPDATE_PRODUCT_SORTING } from "./gql"

interface Product {
    id: string
    customFields?: { sorting?: number | null }
}

export function ProductSortHandle({ value, cell, table }: DataDisplayComponentProps<CellContext<any, any>>) {
    const product = cell.row.original as Product
    const productId = product?.id
    const listValue = typeof value === "number" ? value : (product?.customFields?.sorting ?? 0)
    const [pendingValue, setPendingValue] = useState<number>(listValue)
    const [syncedValue, setSyncedValue] = useState<number>(listValue)
    const paginatedList = useContext<any>(PaginatedListContext as any)
    const tableInstance = (cell as any)?.table ?? table
    const currentSorting = tableInstance?.getState?.().sorting ?? []
    const isSortingColumnActive = currentSorting[0]?.id === "sorting" && currentSorting[0]?.desc === false
    const queryClient = useQueryClient()
    const { mutateAsync: updateSorting, isPending } = useMutation({
        mutationFn: ({ id, sorting }: { id: string; sorting: number }) =>
            api.mutate(UPDATE_PRODUCT_SORTING, {
                input: { id, customFields: { sorting } },
            }),
    })

    useEffect(() => {
        setPendingValue(listValue)
        setSyncedValue(listValue)
    }, [listValue])

    const isDirty = useMemo(() => pendingValue !== syncedValue, [pendingValue, syncedValue])

    if (!productId) {
        return null
    }

    async function persistSorting(nextValue: number) {
        try {
            await updateSorting({ id: productId, sorting: nextValue })
            setSyncedValue(nextValue)
            setPendingValue(nextValue)
            toast.success("Produktreihenfolge aktualisiert")
            if (paginatedList?.refetchPaginatedList) {
                paginatedList.refetchPaginatedList()
            } else {
                queryClient.invalidateQueries({ queryKey: ["PaginatedListDataTable"] })
            }
        } catch (error) {
            toast.error("Sortierung konnte nicht gespeichert werden", {
                description: error instanceof Error ? error.message : String(error),
            })
        }
    }

    function clampValue(nextValue: number) {
        if (Number.isNaN(nextValue)) {
            return syncedValue
        }
        return Math.round(nextValue)
    }

    function handleInputChange(event: ChangeEvent<HTMLInputElement>) {
        setPendingValue(clampValue(Number(event.target.value)))
    }

    async function handleMove(direction: "up" | "down") {
        if (isPending || !isSortingColumnActive) {
            return
        }

        const rows = tableInstance?.getRowModel().rows
        if (!rows) {
            toast.error("Tabellenkontext nicht verfügbar")
            return
        }
        const currentIndex = rows.findIndex((row) => row.id === cell.row.id)
        const offset = direction === "up" ? -1 : 1
        const targetIndex = currentIndex + offset
        const targetRow = rows[targetIndex]

        if (!targetRow) {
            toast.info(direction === "up" ? "Bereits an erster Position" : "Bereits an letzter Position")
            return
        }

        const targetProduct = targetRow.original as Product

        const neighborSorting = targetProduct?.customFields?.sorting ?? 0
        const nextValue = direction === "down" ? neighborSorting + 1 : neighborSorting - 1

        try {
            await updateSorting({ id: productId, sorting: nextValue })
            setPendingValue(nextValue)
            setSyncedValue(nextValue)
            toast.success("Produkt verschoben")
            if (paginatedList?.refetchPaginatedList) {
                paginatedList.refetchPaginatedList()
            } else {
                queryClient.invalidateQueries({ queryKey: ["PaginatedListDataTable"] })
            }
        } catch (error) {
            toast.error("Produkt konnte nicht verschoben werden", {
                description: error instanceof Error ? error.message : String(error),
            })
        }
    }

    async function handleCommit() {
        if (!isDirty || isPending) {
            return
        }
        await persistSorting(pendingValue)
    }

    async function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
        if (event.key === "Enter") {
            event.preventDefault()
            await handleCommit()
        }
    }

    return (
        <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
                {isSortingColumnActive && (
                    <ActionButton type="button" size="icon" variant="outline" onClick={() => handleMove("up")} disabled={isPending} aria-label="Sortierung nach oben">
                        ↑
                    </ActionButton>
                )}
                <Input type="number" value={pendingValue} min={0} onChange={handleInputChange} onBlur={handleCommit} onKeyDown={handleKeyDown} className="h-8 w-20" disabled={isPending} />
                {isSortingColumnActive && (
                    <ActionButton type="button" size="icon" variant="outline" onClick={() => handleMove("down")} disabled={isPending} aria-label="Sortierung nach unten">
                        ↓
                    </ActionButton>
                )}
            </div>
        </div>
    )
}
