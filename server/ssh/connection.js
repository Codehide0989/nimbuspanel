const { NodeSSH } = require("node-ssh");
const { decrypt } = require("../lib/crypto");
const { getPresignedUrl } = require("../lib/s3");

/**
 * Build SSH connection options from a VPS record, decrypting/fetching
 * credentials based on the configured auth method.
 */
async function buildConnectOptions(vps) {
  const opts = {
    host: vps.publicIp,
    port: vps.sshPort,
    username: vps.username,
    readyTimeout: 15000,
    keepaliveInterval: 30000,
    keepaliveCountMax: 3,
  };

  if (vps.authMethod === "password" && vps.passwordEnc) {
    opts.password = decrypt(vps.passwordEnc);
  } else if (vps.pemKeyS3Key) {
    const pemUrl = await getPresignedUrl(vps.pemKeyS3Key);
    const resp = await fetch(pemUrl);
    if (!resp.ok) throw new Error("Cannot retrieve SSH key");
    opts.privateKey = await resp.text();
    if (vps.keyPassphrase) opts.passphrase = decrypt(vps.keyPassphrase);
  } else {
    throw new Error("No authentication credentials configured");
  }

  return opts;
}

/**
 * Connect via SSH and open an interactive PTY shell.
 * Returns { ssh, shell }.
 */
async function createShell(vps) {
  const opts = await buildConnectOptions(vps);
  const ssh = new NodeSSH();
  await ssh.connect(opts);

  const connection = ssh.connection;
  const shell = await new Promise((resolve, reject) => {
    connection.shell(
      { term: "xterm-256color", cols: 120, rows: 30 },
      (err, stream) => (err ? reject(err) : resolve(stream))
    );
  });

  return { ssh, shell };
}

module.exports = { buildConnectOptions, createShell };
