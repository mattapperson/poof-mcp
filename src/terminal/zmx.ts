import { execSync } from "child_process";
import type { ZmxSession } from "../types";

export function isZmxInstalled(): boolean {
  try {
    execSync("which zmx", { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

export function listSessions(): ZmxSession[] {
  try {
    const output = execSync("zmx list", {
      encoding: "utf-8",
      stdio: "pipe",
    });

    const trimmed = output.trim();

    // zmx outputs "no sessions found in /tmp/zmx" when empty
    if (trimmed.startsWith("no sessions found")) {
      return [];
    }

    const lines = trimmed.split("\n");

    // Parse session names from zmx list output format:
    // session_name=VALUE    pid=VALUE       clients=VALUE
    return lines
      .filter((line) => line.length > 0)
      .map((line) => {
        const nameMatch = line.match(/session_name=(\S+)/);
        const pidMatch = line.match(/pid=(\d+)/);
        const clientsMatch = line.match(/clients=(\d+)/);

        return {
          name: nameMatch ? nameMatch[1] : line.trim(),
          pid: pidMatch ? parseInt(pidMatch[1], 10) : undefined,
          clients: clientsMatch ? parseInt(clientsMatch[1], 10) : undefined,
        };
      });
  } catch (error: unknown) {
    // No sessions exist or zmx not running
    if (error && typeof error === "object" && "status" in error && error.status === 1) {
      return [];
    }
    throw error;
  }
}

export function sessionExists(sessionName: string): boolean {
  const sessions = listSessions();
  return sessions.some((s) => s.name === sessionName);
}

export function killSession(sessionName: string): void {
  execSync(`zmx kill "${sessionName}"`, { stdio: "pipe" });
}

export function killAllSessions(): number {
  const sessions = listSessions();
  sessions.forEach((session) => {
    execSync(`zmx kill "${session.name}"`, { stdio: "pipe" });
  });
  return sessions.length;
}
