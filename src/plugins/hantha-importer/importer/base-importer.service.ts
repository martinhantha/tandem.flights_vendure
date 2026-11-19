import { INestApplicationContext } from '@nestjs/common/interfaces/nest-application-context.interface';
import { bootstrapWorker, Channel, ChannelService, RequestContext, SearchService, VendureConfig } from '@vendure/core';
import { getSuperadminContext } from '../utils';

/** The statistics repeat at most this many row errors, so a broken column does not print every row twice. */
const MAX_LISTED_ROW_ERRORS = 20;

export interface BaseImporterServiceOptions {
    channel: number;
}

export abstract class BaseImporterService {
    protected app: INestApplicationContext;
    protected ctx: RequestContext;
    protected searchService: SearchService;
    protected initialized = false;
    protected channel: Channel;

    private processedCount = 0;
    private updatedCount = 0;
    private createdCount = 0;
    private rowErrors: string[] = [];

    constructor(options: BaseImporterServiceOptions = { channel: 1 }) {
        this.channel = new Channel({ id: options.channel });
    }

    /**
     * Initialize the service with async dependencies.
     * Must be called before using any other methods.
     * @param {VendureConfig} config - The Vendure configuration object.
     * @returns {Promise<void>}
     * @throws {Error} If the service is already initialized.
     * @memberof BaseImporterService
     */
    public async initialize(config: VendureConfig): Promise<void> {
        if (this.initialized) {
            return;
        }

        const { app } = await bootstrapWorker(config);
        this.app = app;
        this.ctx = await getSuperadminContext(app);
        this.searchService = this.app.get(SearchService);

        const channelService = this.app.get(ChannelService);
        try {
            const channelObject = await channelService.findOne(this.ctx, this.channel.id);

            if (!channelObject) {
                throw new Error(`Channel with ID ${this.channel.id} not found.`);
            }

            this.channel = channelObject;
        } catch (error) {
            // without the channel the language columns (slug:<lang>, name:<lang>) resolve to "undefined"
            // and every row would fail, so the import must not start. Closing the app lets the process exit.
            await this.app.close();
            throw error;
        }

        this.initialized = true;
    }

    /**
     * Closes the service and cleans up resources.
     * Should be called when the service is no longer needed. It also triggers a reindex of the search service.
     * @throws {Error} If the service is not initialized.
     * @returns {Promise<void>}
     * @memberof BaseImporterService
     */
    public async close(): Promise<void> {
        await this.searchService.reindex(this.ctx);

        if (this.app) {
            await this.app.close();
            this.initialized = false;
        }
    }

    /**
     * Ensures the service is initialized before proceeding with any operations.
     * Throws an error if the service is not initialized.
     * @protected
     * @throws {Error} If the service is not initialized.
     * @returns {void}
     * @memberof BaseImporterService
     */
    protected ensureInitialized(): void {
        if (!this.initialized) {
            throw new Error(
                'BaseImporterService must be initialized before use. Call initialize() or use create() method.',
            );
        }
    }

    /**
     * Resets the counters for imported, updated, and created items.
     * This is useful for starting a new import session without retaining previous counts.
     * @protected
     * @returns {void}
     * @memberof BaseImporterService
     */
    protected resetCounters(): void {
        this.processedCount = 0;
        this.updatedCount = 0;
        this.createdCount = 0;
        this.rowErrors = [];
    }

    /**
     * Reports a problem with the row that is currently imported, in a single line. The row number is the
     * row's 1-based position in the imported data - straight from `parseCSV` that is line number + 1 of the
     * file, as line 1 is the header. The key (slug, code, sku, ...) makes the row searchable either way.
     * All row errors are listed again in the statistics.
     * @protected
     * @param {string | undefined} key - The value identifying the row, if it has one.
     * @param {string} message - What went wrong.
     * @returns {void}
     * @memberof BaseImporterService
     */
    protected rowError(key: string | undefined, message: string): void {
        const line = `${this.rowLabel(key)}: ${message}`;
        this.rowErrors.push(line);
        console.error(line);
    }

    /**
     * Reports something noteworthy about the current row that did not stop it from being imported.
     * @protected
     * @param {string | undefined} key - The value identifying the row, if it has one.
     * @param {string} message - What to point out.
     * @returns {void}
     * @memberof BaseImporterService
     */
    protected rowWarning(key: string | undefined, message: string): void {
        console.warn(`${this.rowLabel(key)}: ${message}`);
    }

    private rowLabel(key: string | undefined): string {
        return `Row ${this.processedCount}${key ? ` (${key})` : ''}`;
    }

    /**
     * Ends an import that hit an unexpected error: tells at which row it stopped, prints the statistics up
     * to that point and rethrows, so the calling script stops instead of carrying on with half the data.
     * @protected
     * @param {string} name - What was imported, e.g. "Product".
     * @param {unknown} error - The error that stopped the import.
     * @returns {never}
     * @memberof BaseImporterService
     */
    protected abortImport(name: string, error: unknown): never {
        console.error(`❌ ${name} import aborted at row ${this.processedCount}`);
        this.logStatistics();
        throw error;
    }

    /**
     * Increments the record count for an imported item.
     * This method should be called when an existing record is updated during the import process.
     * @protected
     * @returns {void}
     * @memberof BaseImporterService
     */
    protected incrementUpdatedCount(): void {
        this.updatedCount++;
    }

    /**
     * Increments the record count for a created item.
     * This method should be called when a new record is created during the import process.
     * @protected
     * @returns {void}
     * @memberof BaseImporterService
     */
    protected incrementCreatedCount(): void {
        this.createdCount++;
    }

    /**
     * Increments the count of processed items.
     * This method should be called for each item processed during the import, regardless of whether it was created or updated.
     * @protected
     * @returns {void}
     * @memberof BaseImporterService
     */
    protected incrementProcessedCount(): void {
        this.processedCount++;
    }

    /**
     * Logs a summary of import statistics with enhanced formatting and emojis.
     * Displays the total number of processed, updated, created, failed, and imported items.
     * @protected
     * @returns {void}
     * @memberof BaseImporterService
     */
    protected logStatistics(): void {
        const totalUpdated = this.updatedCount;
        const totalCreated = this.createdCount;
        const totalImported = totalUpdated + totalCreated;
        const totalFailed = this.processedCount - totalImported;

        console.log('\n==================== 📊 Import Statistics 📊 ====================');
        console.log(`📝 Total Processed: ${this.processedCount}`);
        console.log(`✅ Total Updated:   ${totalUpdated}`);
        console.log(`✨ Total Created:   ${totalCreated}`);
        console.log(`❌ Total Failed:    ${totalFailed}`);
        console.log(`📦 Total Imported:  ${totalImported}`);
        if (this.rowErrors.length) {
            const shown = this.rowErrors.slice(0, MAX_LISTED_ROW_ERRORS);
            console.log(`\n⚠️  Row errors:`);
            shown.forEach((line) => console.log(`   ${line}`));
            if (this.rowErrors.length > shown.length) {
                console.log(`   ... and ${this.rowErrors.length - shown.length} more, see the output above`);
            }
        }
        console.log('==================================================================\n');
    }
}
