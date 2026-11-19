import path from "path"
import sharp from "sharp"

const RASTER_IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".tif", ".tiff"])

export function isRasterImageFileName(fileName: string): boolean {
    return RASTER_IMAGE_EXT.has(path.extname(fileName).toLowerCase())
}

/** Apply EXIF orientation and strip the tag — same as Vendure transform-image / SharpAssetPreviewStrategy. */
export async function normalizeRasterImageBuffer(data: Buffer, fileName: string): Promise<Buffer> {
    if (!isRasterImageFileName(fileName)) {
        return data
    }

    try {
        return await sharp(data, { failOn: "none" }).rotate().toBuffer()
    } catch {
        return data
    }
}

export async function getRasterImageDimensions(data: Buffer): Promise<{ width: number; height: number }> {
    const meta = await sharp(data).metadata()
    return {
        width: meta.width ?? 0,
        height: meta.height ?? 0,
    }
}

export async function getRasterImageOrientation(data: Buffer): Promise<number | undefined> {
    const meta = await sharp(data).metadata()
    return meta.orientation
}
