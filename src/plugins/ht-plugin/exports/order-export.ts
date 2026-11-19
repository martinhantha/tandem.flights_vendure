import { ExportInput, ExportStrategy } from "@pinelab/vendure-plugin-order-export"
import { createObjectCsvWriter } from "csv-writer"
import timezonedDayjs from "../services/dayjs"
import os from "os"
import path from "path"

export class OrderExport implements ExportStrategy {
    // Name as shown in the admin UI
    readonly name = "export-bestellungen"
    // Content-type of your export file
    readonly contentType = "text/csv"
    // File extension of your export file
    readonly fileExtension = "csv"
    
    
    async createExportFile({ ctx, startDate, endDate, orderService }: ExportInput): Promise<string> {
        const take = 100
        let skip = 0
        const records = []
        let total = 0
        let max = 2000

        do {
            const batch = await orderService.findAll(
                ctx,
                {
                    filter: {
                        orderPlacedAt: {
                            between: {
                                start: startDate,
                                end: endDate,
                            },
                        },
                    },
                    take,
                    skip,
                },
                [
                    "lines.productVariant",
                    "lines.productVariant.product",
                    "payments",
                    "customer",
                ],
            )

            total = batch.totalItems
            skip += take

            for (const order of batch.items) {
                const payment = order.payments.find((p) => p.state === "Settled")
                for (const line of order.lines) {
                    records.push({
                        order: order.code,
                        date: order.orderPlacedAt?.toISOString(),
                        datePayment: payment?.updatedAt?.toISOString(),
                        customer: `${order.customer?.firstName ?? ""} ${order.customer?.lastName ?? ""}`.trim(),
                        customerEmail: order.customer?.emailAddress,
                        customerPhone: order.customer?.phoneNumber,
                        status: order.state,
                        total: line.linePriceWithTax,
                        payment: payment?.transactionId ?? payment?.method,
                        product: line.productVariant?.translations?.[0]?.name,
                        quantity: line.quantity,
                    })
                }
            }
        } while (records.length < total && records.length < max)
        
        // Do your magic with the order data here

        const fileName = `export-bestellungen-${timezonedDayjs().format("YYYY-MM-DD-HH-mm-ss")}.csv`
        const exportFile = path.join(os.tmpdir(), fileName)

        const csvWriter = createObjectCsvWriter({
            path: exportFile,
            header: [
                { id: "order", title: "Bestellnummer" },
                { id: "date", title: "Datum Bestellung" },
                { id: "datePayment", title: "Datum Bezahlung" },
                { id: "customer", title: "Name" },
                { id: "customerEmail", title: "Email" },
                { id: "customerPhone", title: "Tel." },
                { id: "status", title: "Status" },
                { id: "total", title: "Summe" },
                { id: "payment", title: "Zahlung" },
                { id: "product", title: "Produkt" },
                { id: "quantity", title: "Anzahl" },
            ],
        })
        await csvWriter.writeRecords(records)
        return exportFile
    }
}
