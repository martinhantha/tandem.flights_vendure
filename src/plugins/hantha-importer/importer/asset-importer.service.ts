import { Asset, AssetService, PaginatedList, VendureConfig, isGraphQlErrorResult } from "@vendure/core"
import { BaseImporterService, BaseImporterServiceOptions } from "./base-importer.service"
import { updateAssetMapper, AssetCsvRow } from "../mapper"
import { CustomCreateAssetMapper, CustomFieldMappers, CustomUpdateAssetMapper } from "../types"
import { AssetListOptions } from "@vendure/common/lib/generated-types"
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3"
import { Readable } from "stream"
import fs from "fs"
import path from "path"

/** Object storage the source files are read from, instead of the local `assetsRootPath`. */
export interface AssetImporterServiceS3Options {
    bucket: string
    /** Key prefix the source files live under, e.g. "assets/import". */
    prefix?: string
    region?: string
    /** Endpoint of an S3 compatible object storage. Omit for AWS S3 itself. */
    endpoint?: string
    credentials?: {
        accessKeyId: string
        secretAccessKey: string
    }
    /** Most S3 compatible storages need path style addressing. Defaults to true when an endpoint is set. */
    forcePathStyle?: boolean
}

export interface AssetImporterServiceOptions extends BaseImporterServiceOptions {
    assetsRootPath?: string
    assetsS3?: AssetImporterServiceS3Options
    filenameField?: string

    customCreateMapper?: CustomCreateAssetMapper
    customUpdateMapper?: CustomUpdateAssetMapper
    customFieldMappers?: CustomFieldMappers
}

export class AssetImporterService extends BaseImporterService {
    private assetService: AssetService

    private assetsRootPath: string
    private assetsS3?: AssetImporterServiceS3Options
    private s3Client?: S3Client
    private filenameField: string

    private customCreateMapper?: CustomCreateAssetMapper
    private customUpdateMapper?: CustomUpdateAssetMapper
    private customFieldMappers: CustomFieldMappers = []

    constructor(private options?: AssetImporterServiceOptions) {
        super(options)

        this.assetsRootPath = options?.assetsRootPath ?? "assets"
        this.assetsS3 = options?.assetsS3
        this.filenameField = options?.filenameField ?? "filename"

        this.customCreateMapper = options?.customCreateMapper
        this.customUpdateMapper = options?.customUpdateMapper
        this.customFieldMappers = options?.customFieldMappers ?? []
    }

    /**
     * Creates and initializes a new AssetImporterService instance.
     */
    public static async create(config: VendureConfig, options?: AssetImporterServiceOptions): Promise<AssetImporterService> {
        const service = new AssetImporterService(options)
        await service.initialize(config)
        return service
    }

    /**
     * Imports assets from an array of CSV row data.
     * For each row, attempts to find an existing asset by filename in the current channel.
     * If found, updates the asset; otherwise, creates a new asset.
     * Tracks and logs statistics for processed, created, and updated assets.
     *
     * @param csvData - Array of parsed CSV rows representing asset data.
     * @returns {Promise<void>}
     * @throws If CSV data is missing or if an unexpected error stops the import.
     */
    public async importAssets(csvData: Array<AssetCsvRow>) {
        this.ensureInitialized()

        if (!csvData) {
            throw new Error("CSV data is required for asset import.")
        }

        this.resetCounters()

        try {
            this.assetService = this.app.get(AssetService)

            for (const row of csvData) {
                this.incrementProcessedCount()

                const options: AssetListOptions = {
                    filter: {
                        name: { eq: row[this.filenameField as keyof AssetCsvRow] as string },
                    },
                }

                const fetchResult: PaginatedList<Asset> | undefined = await this.assetService.findAll(this.ctx, options)

                if (fetchResult && fetchResult.items.length > 0) {
                    await this.updateAsset(fetchResult.items[0].id.toString(), row)
                } else {
                    await this.createAsset(row)
                }
            }

            this.logStatistics()
        } catch (error) {
            this.abortImport("Asset", error)
        }
    }

    /**
     * Creates a new asset in Vendure.
     * @param row - The row from the CSV file containing asset data.
     * @returns {Promise<void>}
     */
    private async createAsset(row: AssetCsvRow): Promise<void> {
        const filename: string = row[this.filenameField as keyof AssetCsvRow] as string
        if (!filename) {
            this.rowError(undefined, `missing '${this.filenameField}'`)
            return
        }

        // a custom mapper builds the whole CreateAssetInput itself, including the file upload
        if (this.customCreateMapper) {
            const asset = this.customCreateMapper(this.assetsRootPath, row, this.customFieldMappers)

            if (!asset) {
                this.rowError(filename, "skipped, the mapper returned no data (required fields missing)")
                return
            }

            const result = await this.assetService.create(this.ctx, asset)

            if (isGraphQlErrorResult(result)) {
                this.rowError(filename, `asset could not be created: ${result.message}`)
                return
            }

            this.incrementCreatedCount()
            return
        }

        const location = this.getAssetLocation(filename)
        const stream = await this.openAssetFile(filename)

        if (!stream) {
            this.rowError(filename, `file not found: ${location}`)
            return
        }

        // createFromFileStream is Vendure's own entry point for data imports: it derives the asset
        // name and the mime type from the given path, so an imported asset ends up identical to
        // one uploaded through the dashboard
        const result = await this.assetService.createFromFileStream(stream, filename, this.ctx)

        if (isGraphQlErrorResult(result)) {
            this.rowError(filename, `asset could not be created: ${result.message}`)
            return
        }

        // custom fields are not part of createFromFileStream, so they are applied in a second step
        const customFields = Object.assign({}, ...this.customFieldMappers.map((mapper) => mapper(row)))
        if (Object.keys(customFields).length) {
            await this.assetService.update(this.ctx, { id: result.id, customFields })
        }

        this.incrementCreatedCount()
    }

    /**
     * Opens the source file of an asset, either in the configured object storage or, if none is
     * configured, below the local assets root.
     *
     * @param filename - The asset filename as written in the CSV.
     * @returns A readable stream of the file, or undefined if the file does not exist.
     */
    private async openAssetFile(filename: string): Promise<Readable | undefined> {
        if (!this.assetsS3) {
            const filePath = path.resolve(this.assetsRootPath, filename)
            return fs.existsSync(filePath) ? fs.createReadStream(filePath) : undefined
        }

        try {
            const result = await this.getS3Client().send(
                new GetObjectCommand({
                    Bucket: this.assetsS3.bucket,
                    Key: this.getS3Key(filename),
                }),
            )
            return result.Body as Readable | undefined
        } catch (error: any) {
            // a missing object is skipped like a missing local file, everything else (credentials,
            // endpoint, permissions) is a configuration problem and must not be swallowed
            if (error?.name === "NoSuchKey" || error?.$metadata?.httpStatusCode === 404) {
                return undefined
            }
            throw error
        }
    }

    /** Human readable source of an asset file, used for logging. */
    private getAssetLocation(filename: string): string {
        return this.assetsS3
            ? `s3://${this.assetsS3.bucket}/${this.getS3Key(filename)}`
            : path.resolve(this.assetsRootPath, filename)
    }

    /** Object key of an asset file, built from the configured prefix. */
    private getS3Key(filename: string): string {
        const prefix = (this.assetsS3?.prefix ?? "").replace(/^\/+|\/+$/g, "")
        return prefix ? `${prefix}/${filename}` : filename
    }

    private getS3Client(): S3Client {
        if (!this.s3Client) {
            const { region, endpoint, credentials, forcePathStyle } = this.assetsS3!
            this.s3Client = new S3Client({
                region,
                endpoint,
                credentials,
                forcePathStyle: forcePathStyle ?? !!endpoint,
            })
        }
        return this.s3Client
    }

    public async close(): Promise<void> {
        this.s3Client?.destroy()
        this.s3Client = undefined
        await super.close()
    }

    /**
     * Updates an existing asset in Vendure.
     * @param id - The ID of the asset to update.
     * @param row - The row from the CSV file containing asset data.
     * @returns {Promise<void>}
     */
    private async updateAsset(id: string, row: AssetCsvRow): Promise<void> {
        const filename: string = row[this.filenameField as keyof AssetCsvRow] as string
        if (!id) {
            this.rowError(filename, `invalid asset id '${id}'`)
            return
        }

        if (!filename) {
            this.rowError(undefined, `missing '${this.filenameField}'`)
            return
        }

        const mapper: CustomUpdateAssetMapper = this.customUpdateMapper ?? updateAssetMapper
        const asset = mapper(id, row, this.customFieldMappers)

        if (!asset) {
            this.rowError(filename, "skipped, the mapper returned no data (required fields missing)")
            return
        }

        if (!asset?.id) {
            asset.id = id // Ensure the asset ID is set for update
        }

        const result = await this.assetService.update(this.ctx, asset)

        if (result) {
            this.incrementUpdatedCount()
        } else {
            this.rowError(filename, `asset ${id} could not be updated`)
        }
    }

    /**
     * Adds asset IDs to the CSV data by looking up existing assets.
     * This method iterates through the provided CSV data, finds assets by their filename,
     * and replaces the filenames in the specified field with the corresponding asset IDs.
     * Handles multiple filenames separated by ';' and groups (used for product variants) separated by '|'.
     * @param csvData - An array of CSV rows representing asset data.
     * @param assetIdField - The field in the CSV data where the asset IDs will be added.
     * @param assetFilenamesField - Optional field in the CSV data containing the asset filenames. Defaults to the main filename field.
     * @returns {Promise<Array<any>>} - Returns the updated CSV data with asset IDs added.
     * @throws Will throw an error if CSV data is not provided.
     */
    public async addAssetIds(csvData: Array<any>, assetIdField: string, assetFilenamesField?: string): Promise<Array<any>> {
        this.ensureInitialized()

        if (!csvData) {
            throw Error("CSV data is required for adding asset IDs.")
        }

        this.assetService = this.app.get(AssetService)
        const updatedData = await Promise.all(
            csvData.map(async (row) => {
                const newRow: any = { ...row }

                const filenamesField = assetFilenamesField ?? this.filenameField
                const filenamesValue = row[filenamesField as keyof AssetCsvRow] as string

                if (!filenamesValue) {
                    newRow[assetIdField] = ""
                    return newRow
                }

                // Split by '|' for groups, then by ';' for individual filenames
                const groups = filenamesValue.split("|").map((group) => group.trim())
                const idGroups: string[] = []

                for (const group of groups) {
                    const filenames = group
                        .split(";")
                        .map((f) => f.trim())
                        .filter(Boolean)
                    const ids: string[] = []

                    for (const filename of filenames) {
                        if (!filename) continue
                        const asset = await this.findAssetByName(filename)
                        if (asset) {
                            ids.push(asset.id.toString())
                        } else {
                            console.log(`No asset found for filename: ${filename}`)
                        }
                    }

                    idGroups.push(ids.join(";"))
                }

                newRow[assetIdField] = idGroups.join("|")
                return newRow
            }),
        )

        return updatedData
    }

    /**
     * Finds an asset by its name. An imported asset is named after the file it was created from,
     * so the CSV filename is looked up as written first. Only if that misses is a lowercase
     * variant tried, which keeps assets created by an older import (or by hand) findable - on a
     * case sensitive database like Postgres "eq" would not match those otherwise.
     *
     * @param filename - The asset filename as written in the CSV.
     * @returns The matching asset, or undefined if none exists.
     */
    private async findAssetByName(filename: string): Promise<Asset | undefined> {
        const candidates = Array.from(new Set([filename, filename.toLowerCase()]))

        for (const name of candidates) {
            const options: AssetListOptions = {
                filter: {
                    name: { eq: name },
                },
            }
            const fetchResult: PaginatedList<Asset> | undefined = await this.assetService.findAll(this.ctx, options)
            if (fetchResult && fetchResult.items.length > 0) {
                return fetchResult.items[0]
            }
        }

        return undefined
    }
}
