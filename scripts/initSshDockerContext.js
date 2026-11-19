const { exec } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

// set environment variables
const HT_GLOBAL_KEY_PATH = process.env.HT_GLOBAL_KEY_PATH;
const PRIVATE_KEY_PATH = process.env.MY_PRIVATE_KEY_PATH;
const SSH_USER = process.env.SSH_USER || 'root';
const SSH_PORT = process.env.SSH_PORT || '22';

function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getName() {
    // from shop.martestshop.com_vendure to:
    // - domainName: shop.martestshop.com
    // - projectName: shop.martestshop
    // - host: coolify.shop.martestshop.hantha.digital
    const folderName = path.basename(process.cwd());
    const domainName = folderName.replace(/_vendure$/, '');
    const projectName = domainName.replace(/\.[a-z]{2,}(?:\.[a-z]{2,})*$/i, '');
    const host = `coolify.${projectName}.hantha.digital`;
    return { domainName, projectName, host };
}

function ensureSshConfig({ name, user, port, identityFile }) {
    const sshDir = path.join(os.homedir(), '.ssh');
    const sshConfigPath = path.join(sshDir, 'config');

    fs.mkdirSync(sshDir, { recursive: true });

    const begin = `# BEGIN ${name.domainName} (managed by initSshDockerContext.js)`;
    const end = `# END ${name.domainName}`;
    const block =
        `\n${begin}\n` +
        `Host ${name.host}\n` +
        `    HostName ${name.host}\n` +
        `    User ${user}\n` +
        `    Port ${port}\n` +
        `    IdentityFile ${identityFile}\n` +
        `    IdentitiesOnly yes\n` +
        `${end}\n`;

    let existing = '';
    try {
        existing = fs.readFileSync(sshConfigPath, 'utf8');
    } catch (e) {
        if (e?.code !== 'ENOENT') throw e;
    }

    const blockRegex = new RegExp(
        `${escapeRegExp(begin)}[\\s\\S]*?${escapeRegExp(end)}\\n?`,
        'm'
    );
    const nextContent = existing.match(blockRegex)
        ? existing.replace(blockRegex, block)
        : `${existing}${existing && !existing.endsWith('\n') ? '\n' : ''}${block}`;

    fs.writeFileSync(sshConfigPath, nextContent, { mode: 0o600 });
}


const name = getName();

// create docker context

const identityFile =
    HT_GLOBAL_KEY_PATH ||
    PRIVATE_KEY_PATH ||
    path.join(os.homedir(), '.ssh', 'ht-global-key');

ensureSshConfig({
    name,
    user: SSH_USER,
    port: SSH_PORT,
    identityFile,
});

// Use the SSH host alias so settings from ~/.ssh/config apply (IdentityFile, Port, etc.)
const dockerHost = `ssh://${SSH_USER}@${name.host}`;
const createCommand = `docker context create ${name.projectName} --docker "host=${dockerHost}" --description "${name.domainName}"`;
const updateCommand = `docker context update ${name.projectName} --docker "host=${dockerHost}" --description "${name.host}"`;
const env = { ...process.env };
// If KUBECONFIG is mis-set, Docker may try to parse it as YAML and fail.
delete env.KUBECONFIG;

console.log(createCommand);
exec(createCommand, { env }, (error, stdout, stderr) => {
    if (error) {
        const message = String(error?.message || '');
        if (message.includes('already exists')) {
            exec(updateCommand, { env }, (updateError, updateStdout, updateStderr) => {
                if (updateError) {
                    console.error(updateError);
                    return;
                }
                console.log(updateStdout);
                console.log(updateStderr);
            });
            return;
        }
        console.error(error);
        return;
    }
    console.log(stdout);
    console.log(stderr);
});