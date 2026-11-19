import { parse as csvParse } from 'csv-parse';
import fs from 'fs';
import path from 'path';

export class CSVService {
    /**
     * Parses a CSV file and returns an array of objects representing the rows.
     */
    async parseCSV<T>(csvFilePath: string): Promise<T[]> {
        return new Promise((resolve, reject) => {
            const rows: T[] = [];
            const csvFile = fs.createReadStream(csvFilePath);
            const csvParser = csvParse({ columns: true });

            csvFile.pipe(csvParser);

            csvParser.on('data', (row: T) => {
                rows.push(row);
            });

            csvParser.on('end', () => {
                console.log(`CSV file ${path.basename(csvFilePath)} successfully processed (${rows.length} rows)`);
                resolve(rows);
            });

            csvParser.on('error', (error) => {
                reject(error);
            });

            csvFile.on('error', (error) => {
                reject(error);
            });
        });
    }
}
