import { readFileSync } from "fs"

export type SqlRow = Record<string, string | null>

/**
 * Minimal reader for MariaDB/MySQL dumps (phpMyAdmin / mysqldump): returns the rows of the
 * `INSERT INTO \`table\` (...) VALUES (...),(...);` statements of one table as objects.
 * Values are returned as strings (numbers unparsed), NULL as null.
 */
export class SqlDump {
    private readonly sql: string

    constructor(path: string) {
        this.sql = readFileSync(path, "utf-8")
    }

    rows(table: string): SqlRow[] {
        const result: SqlRow[] = []
        const header = new RegExp("INSERT INTO `" + table.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "` \\(([^)]*)\\) VALUES", "g")
        let match: RegExpExecArray | null
        while ((match = header.exec(this.sql))) {
            const columns = match[1].split(",").map((column) => column.trim().replace(/^`|`$/g, ""))
            const { rows, end } = parseValues(this.sql, header.lastIndex)
            for (const values of rows) {
                if (values.length !== columns.length) {
                    throw new Error(`${table}: row has ${values.length} values, expected ${columns.length}`)
                }
                const row: SqlRow = {}
                columns.forEach((column, index) => (row[column] = values[index]))
                result.push(row)
            }
            header.lastIndex = end
        }
        return result
    }
}

const ESCAPES: Record<string, string> = { n: "\n", r: "\r", t: "\t", "0": "\0", Z: "\x1a", b: "\b" }

function parseValues(sql: string, start: number): { rows: Array<Array<string | null>>; end: number } {
    const rows: Array<Array<string | null>> = []
    let i = start
    const skipWhitespace = () => {
        while (i < sql.length && /\s/.test(sql[i])) i++
    }
    for (;;) {
        while (i < sql.length && (sql[i] === "," || /\s/.test(sql[i]))) i++
        if (i >= sql.length || sql[i] === ";") return { rows, end: i }
        if (sql[i] !== "(") throw new Error(`Unexpected character '${sql[i]}' at ${i}`)
        i++
        const row: Array<string | null> = []
        for (;;) {
            skipWhitespace()
            if (sql[i] === "'") {
                i++
                let value = ""
                for (;;) {
                    const char = sql[i]
                    if (char === "\\") {
                        const next = sql[i + 1]
                        value += ESCAPES[next] ?? next
                        i += 2
                    } else if (char === "'") {
                        if (sql[i + 1] === "'") {
                            value += "'"
                            i += 2
                        } else {
                            i++
                            break
                        }
                    } else {
                        value += char
                        i++
                    }
                }
                row.push(value)
            } else {
                let j = i
                while (sql[j] !== "," && sql[j] !== ")") j++
                const token = sql.slice(i, j).trim()
                row.push(token === "NULL" ? null : token)
                i = j
            }
            skipWhitespace()
            if (sql[i] === ",") {
                i++
                continue
            }
            if (sql[i] === ")") {
                i++
                break
            }
            throw new Error(`Unexpected character '${sql[i]}' at ${i}`)
        }
        rows.push(row)
    }
}
