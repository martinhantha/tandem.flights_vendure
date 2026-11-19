/* eslint-disable no-console */
// Portable shim — delegates to the global deploy script.
// Each developer sets DEPLOY_SCRIPT_HOME on their machine, e.g.
//   PowerShell:  [Environment]::SetEnvironmentVariable("DEPLOY_SCRIPT_HOME", "E:\WSNuxt\DeployScript", "User")
//   bash/zsh:    export DEPLOY_SCRIPT_HOME=/path/to/DeployScript
// This file itself is machine-independent and can be committed to the template.

const path = require("path")
const fs = require("fs")

const home = process.env.DEPLOY_SCRIPT_HOME
if (!home) {
    console.error("Error: DEPLOY_SCRIPT_HOME is not set.")
    console.error("Set it to the absolute path of your DeployScript folder, then restart your shell.")
    process.exit(1)
}

const entry = path.join(home, "deploy.js")
if (!fs.existsSync(entry)) {
    console.error(`Error: ${entry} not found. Check that DEPLOY_SCRIPT_HOME points to the DeployScript folder.`)
    process.exit(1)
}

require(entry)
