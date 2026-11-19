import { EmailAttachment } from "@vendure/email-plugin"
import { GlobalSettingsService, Order, ProductService, RequestContext, ConfigService, CurrencyCode, Logger, OrderLine } from "@vendure/core"
import { generate } from "@pdfme/generator"
import { getPlugins, getFontsData } from "../helper/pdf-helper"
import { VoucherService } from "../entities/voucher/service"
import timezonedDayjs from "./dayjs"
import { TextblockService } from "../entities/textblock/service"
import { loggerCtx } from "../constants"
import { convert } from "html-to-text"
import JSZip from "jszip"
import { CustomSettingsService } from "../entities/customSettings/service"

const IS_LOCAL = process.env.APP_LOCAL === "true"
const IS_DEV = process.env.APP_ENV === "dev"

export class VoucherByOrderService {
    constructor(
        private customSettingsService: CustomSettingsService,
        private productService: ProductService,
        private voucherService: VoucherService,
        private configService: ConfigService,
        private textblockService: TextblockService
    ) { }

    private async getText(ctx: RequestContext, key: string, languageCode?: string): Promise<string> {
        return this.textblockService.getText(ctx, key, languageCode)
    }

    public async getVoucherByOrderLine(ctx: RequestContext, order: Order, orderLine: OrderLine, template: any, assetStorageStrategy: any): Promise<EmailAttachment[]> {
        const attachments: EmailAttachment[] = []

        // if no voucher, skip this line, continue with the next one
        if (!orderLine.productVariant?.customFields?.isVoucher) return []

        // get voucher infos
        const product = await this.productService.findOne(ctx, orderLine.productVariant.productId)
        const voucherField = orderLine.customFields?.voucher
        const voucherLang = voucherField?.lang ?? order?.customFields?.languageCode ?? ctx.languageCode
        const voucherPath = process.env.VOUCHER_PATH || "pdfs/voucher-"
        const url = (IS_LOCAL ? process.env.APP_URL_DEV + ":3001" : IS_DEV ? process.env.APP_URL_DEV : process.env.APP_URL_PROD)
        const font = await getFontsData()
        const assetsPath = `${url}/assets/`


        const voucherSalutationDefaultText = await this.getText(ctx, "voucherSalutationDefaultText", voucherLang)
        const voucherMessageDefaultText = await this.getText(ctx, "voucherMessageDefaultText", voucherLang)
        const voucherDatePrefixText = await this.getText(ctx, "voucherDatePrefixText", voucherLang)
        const voucherDateFormat = await this.getText(ctx, "voucherDateFormat", voucherLang)
        const voucherDateSuffixText = await this.getText(ctx, "voucherDateSuffixText", voucherLang)
        const voucherAddressText = await this.getText(ctx, "voucherAddressText", voucherLang)

        // get additional voucher infos
        const translatedProduct = product?.translations.find((t) => t.languageCode === voucherLang)

        const voucherName = translatedProduct?.name ?? ""
        let voucherTitle = voucherName

        const translatedShortDescription = translatedProduct?.customFields?.shortDescription ?? ""
        const translatedDescription = translatedProduct?.description ?? ""
        const combinedVoucherDescription = translatedShortDescription && translatedDescription ? `${translatedShortDescription}\n\n${translatedDescription}` : translatedShortDescription || translatedDescription
        // const voucherDescription = sanitizeHtml(combinedVoucherDescription, {
        //     allowedTags: [],
        //     allowedAttributes: {},
        // })
        const convertOptions = {
            wordwrap: null, // After how many chars a line break should follow. Set to null or false to disable word-wrapping.
        }
        const voucherDescription = convert(combinedVoucherDescription, convertOptions)
        const voucherSalutation = voucherField?.salutation ? voucherField.salutation : voucherSalutationDefaultText
        const voucherMessage = voucherField?.message ? voucherField.message : voucherMessageDefaultText
        const voucherPrice = formatPrice(orderLine.productVariant.priceWithTax, order.currencyCode)
        // plain-text short description, e.g. tandem.flights prints "für Einsteiger und Genießer" under the product name
        const voucherSubtitle = convert(translatedShortDescription, convertOptions)
        // template text fields that are not filled from the order are looked up as textblocks of the same name (per language)
        const textblockInputs = await this.getTextblockInputs(ctx, template, voucherLang)

        // get image
        let base64Image = ''
        // `voucher.image` is configured as a string custom field (URL/path), not an Asset-like object.
        const source = voucherField?.image
        if (source) {
            try {
                const response = await fetch(source + "?w=1500&h=638&mode=crop&fpx=0.5&fpy=0.5")
                if (response.status !== 200) {
                    throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`)
                }
                const arrayBuffer = await response.arrayBuffer()
                const buffer = Buffer.from(arrayBuffer)
                const mimeType = response.headers.get("content-type") ?? "image/jpeg"
                base64Image = `data:${mimeType};base64,${buffer?.toString("base64")}`
            } catch (error) {
                Logger.warn(`Error reading voucher image: ${(error as Error)?.message}`, loggerCtx)
            }
        }

        // create voucher for each quantity
        for (let quantityIndex = 0; quantityIndex < orderLine.quantity; quantityIndex++) {
            // get voucher from db
            const voucher = await this.voucherService.findOneByProductOrderLine(ctx, "" + orderLine.productVariant.id, orderLine, order, quantityIndex, voucherLang)
            const voucherDate = `${voucherDatePrefixText} ${timezonedDayjs(voucher?.validTo).format(voucherDateFormat)} ${voucherDateSuffixText}`

            // get voucher code & path
            const voucherCode = voucher?.code ?? ""
            const pdfPath = `${voucherPath}${voucherCode}.pdf`

            // if voucher already exists, add to attachments & continue with next quantity
            if (await assetStorageStrategy.fileExists(pdfPath)) {
                const attachment = <EmailAttachment>{
                    path: `${assetsPath}${pdfPath}`,
                }

                attachments.push(attachment)
                continue
            }

            Logger.debug("voucher infos" + " " + order.code + " " + orderLine.id + " " + orderLine.productVariant.id + " " + quantityIndex + " " + new Date() + " " + (voucher?.amount ? formatPrice(voucher.amount, order.currencyCode) : voucherPrice), loggerCtx)
            // fill inputs for pdf
            const inputs = [
                {
                    ...textblockInputs,
                    title: voucherTitle,
                    subtitle: voucherSubtitle,
                    code: voucherCode,
                    // SHOP_VOUCHER_QR_URL e.g. "https://tandem.flights/qr?key=" -> the QR code opens the public voucher check page
                    qrCode: (process.env.SHOP_VOUCHER_QR_URL ?? "") + voucherCode,
                    textDescription: voucherDescription,
                    text: `${voucherSalutation}\n\n${voucherMessage}`,
                    price: voucher?.amount ? formatPrice(voucher.amount, order.currencyCode) : voucherPrice,
                    ...(base64Image && { titleImage: base64Image }),
                    textDate: voucherDate,
                    textAddress: voucherAddressText,
                    barcode: voucherCode,
                },
            ]

            // generate pdf
            const pdfUint8Array = await generate({ template, plugins: getPlugins(), inputs, options: { font } })

            // check if pdf is empty
            if (!pdfUint8Array || pdfUint8Array.byteLength === 0) {
                Logger.error(`Generated voucher PDF is empty for order ${order.code}, voucher ${voucherCode}`, loggerCtx)
                return attachments
            }

            // get pdf buffer
            const pdfBuffer = Buffer.from(pdfUint8Array)

            // get pdf url
            const pdfUrl = await assetStorageStrategy.writeFileFromBuffer(pdfPath, pdfBuffer)
            Logger.debug("voucher pdf url: " + pdfUrl, loggerCtx)

            // add attachment
            const attachment = <EmailAttachment>{
                path: `${assetsPath}${pdfPath}`,
            }

            attachments.push(attachment)
        }

        return attachments
    }

    /**
     * Fills every text field of the pdfme template whose name matches an enabled textblock (e.g. "voucherHeadline")
     * with that textblock's translation in the voucher language. This makes static template texts translatable
     * without one template per language. Fields without a textblock keep the template's own content.
     */
    private async getTextblockInputs(ctx: RequestContext, template: any, languageCode: string): Promise<Record<string, string>> {
        const inputs: Record<string, string> = {}
        const schemas: any[] = (template?.schemas ?? []).flat()
        for (const schema of schemas) {
            if (!schema?.name || schema.readOnly || !["text", "multiVariableText"].includes(schema.type)) continue
            const text = await this.getText(ctx, schema.name, languageCode)
            if (text) {
                inputs[schema.name] = convert(text, { wordwrap: null })
            } else if (typeof schema.content === "string") {
                inputs[schema.name] = schema.content
            }
        }
        return inputs
    }

    public async getVoucherByOrder(ctx: RequestContext, order: Order): Promise<EmailAttachment[] | string> {
        let attachments: EmailAttachment[] = []
        const url = (IS_LOCAL ? process.env.APP_URL_DEV + ":3001" : IS_DEV ? process.env.APP_URL_DEV : process.env.APP_URL_PROD)
        const assetsPath = `${url}/assets/`

        // get settings
        const currentSettings = await this.customSettingsService.findOne(ctx, { name: "voucher-template" })
        if (!currentSettings) {
            Logger.error("voucher-template not found", loggerCtx)
            return attachments
        }

        // get template
        let template: any = null
        try {
            template = JSON.parse(currentSettings.value ?? "")
        } catch {
            // an empty or broken value is reported below
        }

        if (!template) {
            Logger.error("voucher-template is empty or not valid JSON", loggerCtx)
            return attachments
        }

        // get attachments
        const { assetStorageStrategy } = this.configService.assetOptions
        for (const line of order.lines) {
            const vouchers = await this.getVoucherByOrderLine(ctx, order, line, template, assetStorageStrategy)
            attachments = [...attachments, ...vouchers]
        }
        Logger.debug(`Order ${order.code}: ${attachments.length} voucher attachment(s)`, loggerCtx)

        if (attachments.length > 3) {
            const name = `voucher-${order.code}`

            const zipBuffer = await createZip(
                attachments.map((attachment) => attachment.path),
                name
            )
            // upload to thw storage

            const pdfUrl = await assetStorageStrategy.writeFileFromBuffer("zip/" + name + "_" + generateHash(name + order.createdAt) + ".zip", zipBuffer)
            return assetsPath + pdfUrl
        }

        return attachments
    }
}

function formatPrice(value: number, currency: CurrencyCode) {
    return new Intl.NumberFormat("de-DE", { style: "currency", currency }).format(value / 100)
}
function generateHash(str: string) {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0
    }
    return (hash >>> 0).toString(36).toUpperCase()
}

async function createZip(files: any[], name: string) {
    const zip = new JSZip()

    // Add files to the ZIP
    await addItemsToZip(zip, files, name)

    const buffer = await zip.generateAsync({ type: "nodebuffer" })

    // Generate the ZIP file
    return buffer
}
async function addItemsToZip(zip: JSZip, urls: string[], name: string) {
    let index = 1

    if (!urls || urls.length === 0) return

    await Promise.all(
        urls.map(async (url: any) => {
            try {
                const response = await fetch(url)
                if (!response.ok) {
                    Logger.error(`Failed to fetch ${url} for voucher zip: ${response.status} ${response.statusText}`, loggerCtx)
                    return
                }

                const blob = await response.blob()
                const arrayBuffer = await blob.arrayBuffer() // Convert blob to ArrayBuffer

                // Get the file extension from the URL
                const ending = url.split("/").pop()?.split(".").pop() || "file"

                zip.file(`${name}_${index++}.${ending}`, arrayBuffer)
            } catch (error) {
                Logger.error(`Error adding file from URL ${url} to voucher zip: ${(error as Error)?.message}`, loggerCtx)
            }
        })
    )
}
