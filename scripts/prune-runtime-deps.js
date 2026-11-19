#!/usr/bin/env node
/**
 * Removes every package from ./node_modules that the compiled runtime code cannot reach.
 *
 * Roots = packages required by dist/** (server, worker, compiled tandem scripts; the built dashboard
 * frontend in dist/dashboard is static and excluded) + EXTRA_ROOTS (loaded dynamically, e.g. the pg
 * driver via typeorm). From the roots the dependency closure is walked through package.json
 * (dependencies, optionalDependencies, installed peerDependencies), resolving like Node does
 * (nested node_modules first, then the hoisted top level). Top-level packages outside the closure
 * are deleted. Used in the Docker "deps" stage only.
 *
 * Usage: node scripts/prune-runtime-deps.js <appDir> [--dry-run]
 */
const fs = require("fs")
const path = require("path")

const appDir = path.resolve(process.argv[2] || ".")
const dryRun = process.argv.includes("--dry-run")
const nm = path.join(appDir, "node_modules")

const EXTRA_ROOTS = ["pg", "pg-native", "sharp", "reflect-metadata", "rxjs", "@vendure/core", "typeorm", "dotenv"]
// Packages whose package.json lists far more than the runtime entry we use needs. The package itself is
// kept, but only these dependencies are followed (checked against the require() calls of that entry).
// @vendure/dashboard: only "@vendure/dashboard/plugin" runs on the server; vite/react/lingui… are build-time.
const SHALLOW = {
    "@vendure/dashboard": ["@nestjs/common", "@nestjs/graphql", "@vendure/core", "date-fns", "express", "express-rate-limit", "graphql-tag"],
}
const BUILTINS = new Set(require("module").builtinModules)

const pkgName = (spec) => {
    if (spec.startsWith(".") || spec.startsWith("/") || spec.startsWith("node:")) return null
    const parts = spec.split("/")
    const name = spec.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0]
    return BUILTINS.has(name) ? null : name
}

const walkJs = (dir, out = []) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, entry.name)
        if (entry.isSymbolicLink()) continue
        if (entry.isDirectory()) {
            if (p === path.join(appDir, "dist", "dashboard")) continue
            walkJs(p, out)
        } else if (entry.name.endsWith(".js")) out.push(p)
    }
    return out
}

const roots = new Set(EXTRA_ROOTS)
const requireRe = /require\(\s*["']([^"']+)["']\s*\)|from\s+["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/g
for (const file of walkJs(path.join(appDir, "dist"))) {
    const src = fs.readFileSync(file, "utf8")
    for (const m of src.matchAll(requireRe)) {
        const name = pkgName(m[1] || m[2] || m[3])
        if (name) roots.add(name)
    }
}

// resolve a dependency like Node: nested node_modules of the parents first, then top level
const resolvePkgDir = (name, fromDir) => {
    let dir = fromDir
    while (dir.startsWith(nm)) {
        const candidate = path.join(dir, "node_modules", name)
        if (fs.existsSync(path.join(candidate, "package.json"))) return candidate
        const parent = path.dirname(dir)
        if (parent === dir) break
        dir = parent
    }
    const top = path.join(nm, name)
    return fs.existsSync(path.join(top, "package.json")) ? top : null
}

const keepTop = new Set()
const seen = new Set()
const queue = []
for (const r of roots) {
    const d = resolvePkgDir(r, nm)
    if (d) queue.push(d)
}
while (queue.length) {
    const dir = queue.pop()
    if (seen.has(dir)) continue
    seen.add(dir)
    const rel = path.relative(nm, dir).split(path.sep)
    keepTop.add(rel[0].startsWith("@") ? `${rel[0]}/${rel[1]}` : rel[0])
    const pj = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8"))
    const deps = { ...(pj.dependencies || {}), ...(pj.optionalDependencies || {}), ...(pj.peerDependencies || {}) }
    const follow = SHALLOW[pj.name] || Object.keys(deps)
    for (const dep of follow) {
        const d = resolvePkgDir(dep, dir)
        if (d) queue.push(d)
    }
}

const topLevel = []
for (const entry of fs.readdirSync(nm)) {
    if (entry.startsWith(".")) continue
    if (entry.startsWith("@")) {
        for (const sub of fs.readdirSync(path.join(nm, entry))) topLevel.push(`${entry}/${sub}`)
    } else topLevel.push(entry)
}

const dirSize = (p) => {
    let total = 0
    for (const e of fs.readdirSync(p, { withFileTypes: true })) {
        const q = path.join(p, e.name)
        if (e.isSymbolicLink()) continue
        total += e.isDirectory() ? dirSize(q) : fs.statSync(q).size
    }
    return total
}

const remove = topLevel.filter((n) => !keepTop.has(n))
let freed = 0
for (const name of remove) {
    const p = path.join(nm, name)
    freed += dirSize(p)
    if (!dryRun) fs.rmSync(p, { recursive: true, force: true })
}
for (const scope of fs.readdirSync(nm).filter((e) => e.startsWith("@"))) {
    const p = path.join(nm, scope)
    if (!dryRun && fs.existsSync(p) && fs.readdirSync(p).length === 0) fs.rmdirSync(p)
}
console.log(`roots: ${roots.size}, kept: ${keepTop.size}, removed: ${remove.length} packages, ${(freed / 1024 / 1024).toFixed(0)} MB${dryRun ? " (dry run)" : ""}`)
if (process.argv.includes("--report")) {
    const kept = [...keepTop].map((n) => [n, dirSize(path.join(nm, n))]).sort((a, b) => b[1] - a[1])
    for (const [n, s] of kept.slice(0, 25)) console.log(`  ${(s / 1024 / 1024).toFixed(1).padStart(7)} MB  ${n}`)
}
