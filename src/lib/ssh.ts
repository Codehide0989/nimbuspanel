import { NodeSSH } from "node-ssh";

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

/**
 * Test SSH connection and return basic validation result.
 */
export async function testSSHConnection(params: {
  host: string;
  port: number;
  username: string;
  privateKey: string;
}): Promise<SSHTestResult> {
  const ssh = new NodeSSH();
  const startTime = Date.now();

  try {
    await ssh.connect({
      host: params.host,
      port: params.port,
      username: params.username,
      privateKey: params.privateKey,
      readyTimeout: 10000,
      tryKeyboard: false,
    });

    const latencyMs = Date.now() - startTime;
    const result = await ssh.execCommand("echo connected");
    ssh.dispose();

    if (result.stdout.trim() === "connected") {
      return { success: true, message: "SSH connection successful", latencyMs };
    }

    return { success: false, message: "Connected but command execution failed" };
  } catch (error) {
    ssh.dispose();
    const msg = error instanceof Error ? error.message : "SSH connection failed";

    if (msg.includes("ECONNREFUSED")) return { success: false, message: "Connection refused. Check host and port." };
    if (msg.includes("ETIMEDOUT") || msg.includes("ENOTFOUND")) return { success: false, message: "Host unreachable. Check IP address." };
    if (msg.includes("authentication") || msg.includes("auth")) return { success: false, message: "Authentication failed. Check username and PEM key." };

    return { success: false, message: msg };
  }
}

/**
 * Collect full system information from a server via SSH.
 */
export async function collectServerInfo(params: {
  host: string;
  port: number;
  username: string;
  privateKey: string;
}): Promise<ServerSystemInfo> {
  const ssh = new NodeSSH();
  const info: ServerSystemInfo = {
    hostname: null, kernel: null, arch: null, cpuCores: null,
    ramTotalMb: null, diskTotalGb: null, diskUsedGb: null,
    diskFreeGb: null, filesystem: null, privateIp: null,
    osName: null, osVersion: null, uptime: null,
  };

  try {
    await ssh.connect({
      host: params.host,
      port: params.port,
      username: params.username,
      privateKey: params.privateKey,
      readyTimeout: 10000,
      tryKeyboard: false,
    });

    // Collect all data in parallel
    const commands = await Promise.allSettled([
      ssh.execCommand("hostname"),
      ssh.execCommand("uname -r"),
      ssh.execCommand("uname -m"),
      ssh.execCommand("nproc"),
      ssh.execCommand("free -m | awk '/^Mem:/{print $2}'"),
      ssh.execCommand("df -BG / | awk 'NR==2{print $2,$3,$4}'"),
      ssh.execCommand("df / | awk 'NR==2{print $1}'"),
      ssh.execCommand("hostname -I | awk '{print $1}'"),
      ssh.execCommand("cat /etc/os-release 2>/dev/null | grep -E '^(NAME|VERSION_ID)=' | head -2"),
      ssh.execCommand("uptime -p 2>/dev/null || uptime"),
    ]);

    const getStdout = (idx: number): string => {
      const r = commands[idx];
      if (r.status === "fulfilled" && r.value.stdout) return r.value.stdout.trim();
      return "";
    };

    info.hostname = getStdout(0) || null;
    info.kernel = getStdout(1) || null;
    info.arch = getStdout(2) || null;

    const cores = parseInt(getStdout(3));
    info.cpuCores = isNaN(cores) ? null : cores;

    const ram = parseInt(getStdout(4));
    info.ramTotalMb = isNaN(ram) ? null : ram;

    // Parse disk: "30G 12G 17G"
    const diskParts = getStdout(5).replace(/G/g, "").split(/\s+/);
    if (diskParts.length >= 3) {
      info.diskTotalGb = parseFloat(diskParts[0]) || null;
      info.diskUsedGb = parseFloat(diskParts[1]) || null;
      info.diskFreeGb = parseFloat(diskParts[2]) || null;
    }

    info.filesystem = getStdout(6) || null;
    info.privateIp = getStdout(7) || null;

    // Parse OS release
    const osRelease = getStdout(8);
    const nameMatch = osRelease.match(/NAME="?([^"\n]+)"?/);
    const versionMatch = osRelease.match(/VERSION_ID="?([^"\n]+)"?/);
    info.osName = nameMatch ? nameMatch[1] : null;
    info.osVersion = versionMatch ? versionMatch[1] : null;

    info.uptime = getStdout(9) || null;

    ssh.dispose();
  } catch (error) {
    ssh.dispose();
    console.error("[collectServerInfo] Error:", error);
  }

  return info;
}
