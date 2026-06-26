import { NodeSSH } from "node-ssh";

export interface SSHCredentials {
  host: string;
  port: number;
  username: string;
  authMethod: "key" | "password";
  privateKey?: string;
  passphrase?: string;
  password?: string;
}

export interface SSHTestResult {
  success: boolean;
  message: string;
  latencyMs?: number;
}

export interface ServerSystemInfo {
  hostname: string | null;
  kernel: string | null;
  arch: string | null;
  cpuCores: number | null;
  ramTotalMb: number | null;
  diskTotalGb: number | null;
  diskUsedGb: number | null;
  diskFreeGb: number | null;
  filesystem: string | null;
  privateIp: string | null;
  osName: string | null;
  osVersion: string | null;
  uptime: string | null;
}

function buildConnectOptions(creds: SSHCredentials): Record<string, unknown> {
  const opts: Record<string, unknown> = {
    host: creds.host,
    port: creds.port,
    username: creds.username,
    readyTimeout: 15000,
    tryKeyboard: false,
  };

  if (creds.authMethod === "password" && creds.password) {
    opts.password = creds.password;
  } else if (creds.authMethod === "key" && creds.privateKey) {
    opts.privateKey = creds.privateKey;
    if (creds.passphrase) opts.passphrase = creds.passphrase;
  }

  return opts;
}

/**
 * Test SSH connection with either key or password authentication.
 */
export async function testSSHConnection(creds: SSHCredentials): Promise<SSHTestResult> {
  const ssh = new NodeSSH();
  const startTime = Date.now();

  try {
    await ssh.connect(buildConnectOptions(creds) as Parameters<typeof ssh.connect>[0]);
    const latencyMs = Date.now() - startTime;

    const result = await ssh.execCommand("echo ok");
    ssh.dispose();

    if (result.stdout.trim() === "ok") {
      return { success: true, message: "SSH connection successful", latencyMs };
    }
    return { success: false, message: "Connected but shell execution failed" };
  } catch (error) {
    ssh.dispose();
    const msg = error instanceof Error ? error.message : "SSH connection failed";

    if (msg.includes("ECONNREFUSED")) return { success: false, message: "Connection refused — check host and port" };
    if (msg.includes("ETIMEDOUT") || msg.includes("ENOTFOUND")) return { success: false, message: "Host unreachable — check IP address or domain" };
    if (msg.includes("ECONNRESET")) return { success: false, message: "Connection reset — SSH service may be unavailable" };
    if (msg.includes("All configured authentication methods failed")) return { success: false, message: "Authentication failed — wrong password or invalid key" };
    if (msg.includes("authentication") || msg.includes("auth")) return { success: false, message: "Authentication failed — check credentials" };
    if (msg.includes("passphrase")) return { success: false, message: "Private key requires a passphrase" };
    if (msg.includes("Invalid key") || msg.includes("key_parse")) return { success: false, message: "Invalid private key format" };

    return { success: false, message: msg };
  }
}

/**
 * Collect system information from a server via SSH.
 */
export async function collectServerInfo(creds: SSHCredentials): Promise<ServerSystemInfo> {
  const ssh = new NodeSSH();
  const info: ServerSystemInfo = {
    hostname: null, kernel: null, arch: null, cpuCores: null,
    ramTotalMb: null, diskTotalGb: null, diskUsedGb: null,
    diskFreeGb: null, filesystem: null, privateIp: null,
    osName: null, osVersion: null, uptime: null,
  };

  try {
    await ssh.connect(buildConnectOptions(creds) as Parameters<typeof ssh.connect>[0]);

    const commands = await Promise.allSettled([
      ssh.execCommand("hostname"),
      ssh.execCommand("uname -r"),
      ssh.execCommand("uname -m"),
      ssh.execCommand("nproc 2>/dev/null || grep -c ^processor /proc/cpuinfo 2>/dev/null"),
      ssh.execCommand("free -m 2>/dev/null | awk '/^Mem:/{print $2}'"),
      ssh.execCommand("df -BG / 2>/dev/null | awk 'NR==2{print $2,$3,$4}'"),
      ssh.execCommand("df / 2>/dev/null | awk 'NR==2{print $1}'"),
      ssh.execCommand("hostname -I 2>/dev/null | awk '{print $1}'"),
      ssh.execCommand("cat /etc/os-release 2>/dev/null | grep -E '^(NAME|VERSION_ID)=' | head -2"),
      ssh.execCommand("uptime -p 2>/dev/null || uptime | sed 's/.*up/up/'"),
    ]);

    const get = (idx: number): string => {
      const r = commands[idx];
      if (r.status === "fulfilled" && r.value.stdout) return r.value.stdout.trim();
      return "";
    };

    info.hostname = get(0) || null;
    info.kernel = get(1) || null;
    info.arch = get(2) || null;

    const cores = parseInt(get(3));
    info.cpuCores = isNaN(cores) ? null : cores;

    const ram = parseInt(get(4));
    info.ramTotalMb = isNaN(ram) ? null : ram;

    const diskParts = get(5).replace(/G/g, "").split(/\s+/);
    if (diskParts.length >= 3) {
      info.diskTotalGb = parseFloat(diskParts[0]) || null;
      info.diskUsedGb = parseFloat(diskParts[1]) || null;
      info.diskFreeGb = parseFloat(diskParts[2]) || null;
    }

    info.filesystem = get(6) || null;
    info.privateIp = get(7) || null;

    const osRelease = get(8);
    const nameMatch = osRelease.match(/NAME="?([^"\n]+)"?/);
    const versionMatch = osRelease.match(/VERSION_ID="?([^"\n]+)"?/);
    info.osName = nameMatch ? nameMatch[1] : null;
    info.osVersion = versionMatch ? versionMatch[1] : null;

    info.uptime = get(9) || null;

    ssh.dispose();
  } catch (error) {
    ssh.dispose();
    console.error("[collectServerInfo]", error);
  }

  return info;
}
