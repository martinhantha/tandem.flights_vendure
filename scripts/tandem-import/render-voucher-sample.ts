/**
 * Renders a sample voucher PDF with the tandem template and the texts of all languages, without DB.
 *   yarn ts-node scripts/tandem-import/render-voucher-sample.ts [outDir]
 */
import { readFileSync, writeFileSync, mkdirSync } from "fs"
import path from "path"
import { generate } from "@pdfme/generator"
import { getPlugins } from "../../src/plugins/ht-plugin/helper/pdf-helper"
import { buildVoucherTemplate, FONT_FILE } from "./lib/voucher-template"
import { VOUCHER_TEXTBLOCKS } from "./voucher-template/textblocks"

async function main() {
    const outDir = process.argv[2] ?? path.join(__dirname, "out")
    mkdirSync(outDir, { recursive: true })
    const template = buildVoucherTemplate()
    const font = { Roboto: { data: readFileSync(FONT_FILE), fallback: true } }
    for (const lang of ["de", "it", "en"] as const) {
        const text = (key: string) => VOUCHER_TEXTBLOCKS[key]?.[lang] ?? ""
        const code = "AB12CD34"
        const inputs = [
            {
                voucherHeadline: text("voucherHeadline"),
                voucherSubline: text("voucherSubline"),
                voucherQuote: text("voucherQuote"),
                voucherQuoteAuthor: text("voucherQuoteAuthor"),
                voucherContactText: text("voucherContactText"),
                title: "Easy Flight",
                subtitle: lang === "de" ? "für Einsteiger und Genießer" : lang === "it" ? "per debuttanti e appassionati" : "for beginners",
                code,
                qrCode: "https://tandem.flights/qr?key=" + code,
                textAddress: text("voucherAddressText"),
                textDate: `${text("voucherDatePrefixText")} 19.11.2027`,
            },
        ]
        const pdf = await generate({ template, plugins: getPlugins() as any, inputs, options: { font } })
        writeFileSync(path.join(outDir, `voucher-sample-${lang}.pdf`), pdf)
    }
    console.log("written to " + outDir)
}
main().catch((e) => {
    console.error(e)
    process.exit(1)
})
