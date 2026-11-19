import { DefaultLogger } from "@vendure/core"

export class CustomLogger extends DefaultLogger {
    override verbose(message: string, context?: string) {
        // KONKRETEN Elasticsearch-Ping rausfiltern
        if (message.includes("Pinging Elasticsearch") || message.includes("Ping to Elasticsearch successful")) {
            return
        }
        super.verbose(message, context)
    }
}
