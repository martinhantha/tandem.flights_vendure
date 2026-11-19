import { InitialData, ListQueryOptions, Populator, VendureConfig, Zone, ZoneService } from "@vendure/core"
import { BaseImporterService, BaseImporterServiceOptions } from "./base-importer.service"
import { CreateZoneInput, UpdateZoneInput } from "@vendure/common/lib/generated-types"

export interface BasicImporterServiceOptions extends BaseImporterServiceOptions {}

export class BasicImporterService extends BaseImporterService {
    private zoneService: ZoneService

    /**
     * Creates and initializes a new BasicImporterService instance.
     */
    public static async create(config: VendureConfig, options?: BasicImporterServiceOptions): Promise<BasicImporterService> {
        const service = new BasicImporterService(options)
        await service.initialize(config)
        return service
    }

    /**
     * Imports initial data into the Vendure instance.
     * This method uses the Populator service to populate the initial data.
     * @param {InitialData} initialData - The initial data to import.
     * @returns {Promise<void>}
     * @throws {Error} If the service is not initialized or if an error occurs during import.
     * @memberof BaseImporterService
     */
    public async importInitialData(initialData: InitialData): Promise<void> {
        this.ensureInitialized()

        const populator = this.app.get(Populator)

        try {
            await populator.populateInitialData(initialData, this.channel)
            console.log("Populated initial data")
        } catch (err: any) {
            // rethrown, so the calling script stops instead of importing into an incomplete setup
            console.error(`❌ Initial data import failed: ${err.message}`)
            throw err
        }
    }

    /**
     * Imports a zone into the Vendure instance.
     * If a zone with the same name already exists, it updates that zone; otherwise, it creates a new zone.
     * @param {CreateZoneInput} input - The input data for creating or updating the zone.
     * @returns {Promise<Zone>} The created or updated zone.
     * @throws {Error} If an error occurs during the import process.
     */
    public async importZone(input: CreateZoneInput): Promise<Zone> {
        this.ensureInitialized()

        this.zoneService = this.app.get(ZoneService)

        try {
            const query: ListQueryOptions<Zone> = {
                filter: {
                    name: { eq: input.name },
                },
                take: 1,
            }

            const result = await this.zoneService.findAll(this.ctx, query)

            if (result?.items?.length > 0) {
                console.log(`Found existing zone with ID: ${result.items[0].id}`)
                const updateInput: UpdateZoneInput = {
                    ...input,
                    id: "" + result.items[0].id,
                }

                return await this.zoneService.update(this.ctx, <any>updateInput)
            } else {
                return await this.zoneService.create(this.ctx, <any>input)
            }
        } catch (err: any) {
            console.error(err.message)
            throw err
        }
    }
}
