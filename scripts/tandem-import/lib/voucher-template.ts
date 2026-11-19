import { readFileSync } from "fs"
import path from "path"

const ASSETS_DIR = path.join(__dirname, "../assets")
const TEMPLATE_PATH = path.join(__dirname, "../voucher-template/tandem-voucher-template.json")

/**
 * Loads the tandem.flights pdfme voucher template and inlines the images referenced as
 * "asset:<path below scripts/tandem-import/assets>" as base64 data URIs.
 */
export function buildVoucherTemplate(): any {
    const template = JSON.parse(readFileSync(TEMPLATE_PATH, "utf-8"))
    for (const page of template.schemas) {
        for (const schema of page) {
            if (typeof schema.content === "string" && schema.content.startsWith("asset:")) {
                const file = path.join(ASSETS_DIR, schema.content.slice("asset:".length))
                const mime = file.endsWith(".png") ? "image/png" : "image/jpeg"
                schema.content = `data:${mime};base64,${readFileSync(file).toString("base64")}`
            }
        }
    }
    return template
}

export const FONT_FILE = path.join(ASSETS_DIR, "fonts/roboto-regular.ttf")
/** where pdf-helper.ts (getFontsData) loads the font from: <asset url>/assets/fonts/roboto-regular.ttf */
export const FONT_ASSET_PATH = "fonts/roboto-regular.ttf"
