/**
 * Command line helpers for the import scripts.
 * The SQL dump path comes from `--dump <path>` or the env var TANDEM_SQL_DUMP. The dump contains
 * personal data: keep it outside the repository and never commit it or anything extracted from it.
 */
export function getArg(name: string): string | undefined {
    const index = process.argv.indexOf(`--${name}`)
    if (index > -1) return process.argv[index + 1]
    const inline = process.argv.find((arg) => arg.startsWith(`--${name}=`))
    return inline ? inline.slice(name.length + 3) : undefined
}

export function hasFlag(name: string): boolean {
    return process.argv.includes(`--${name}`)
}

export function getDumpPath(): string {
    const dumpPath = getArg("dump") ?? process.env.TANDEM_SQL_DUMP
    if (!dumpPath) {
        console.error("Missing SQL dump: pass --dump /path/to/tandema_db0.sql or set TANDEM_SQL_DUMP")
        process.exit(1)
    }
    return dumpPath
}
