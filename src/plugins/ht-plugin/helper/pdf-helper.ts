import { Font } from "@pdfme/common"
import { text, barcodes, image, svg, line } from "@pdfme/schemas"
import { Logger } from "@vendure/core"

const IS_LOCAL = process.env.APP_LOCAL === "true"
const IS_DEV = process.env.APP_ENV === "dev"

// https://pdfme.com/docs/custom-fonts
const fontObjList = [
    {
        fallback: true,
        label: "Roboto",
        url: "/assets/fonts/roboto-regular.ttf",
    },
    // {
    // 	fallback: true,
    // 	label: 'HelveticaNeueProLight',
    // 	url: '/assets/fonts/HelveticaNeueProLight.woff2',
    // },
    // {
    // 	fallback: false,
    // 	label: 'HelveticaNeueProBold',
    // 	url: '/assets/fonts/HelveticaNeueProBold.woff2',
    // },
]

export const getFontsData = async (url: string = "") => {
    const urlToUse = url || (IS_LOCAL ? process.env.APP_URL_DEV + ":3001" : IS_DEV ? process.env.APP_URL_DEV : process.env.APP_URL_PROD)
    Logger.debug("getFontsData url: " + urlToUse, "PDF Helper")
    const fontDataList = await Promise.all(
        fontObjList.map(async (font) => ({
            ...font,
            data: await fetch(`${urlToUse}${font.url}`).then((res) => res.arrayBuffer()),
        })),
    )

    return fontDataList.reduce((acc, font) => ({ ...acc, [font.label]: font }), {} as Font)
}

export const cloneDeep = (obj: unknown) => JSON.parse(JSON.stringify(obj))

export const getPlugins = () => {
    return {
        text,
        line,
        image,
        svg,
        qR: barcodes.qrcode,
        barcodes: barcodes.code128,
    }
}

export const isJsonString = (str: string) => {
    try {
        JSON.parse(str)
    } catch (e) {
        return false
    }
    return true
}
