import type { SessionStatus, ScreenshotResult, ZmxSession } from "../types";
import * as zmx from "./zmx";
import * as applescript from "./applescript";

export class TerminalManager {
  private currentSession: string | null = null;
  private windowId: number | null = null;

  constructor() {
    if (!zmx.isZmxInstalled()) {
      throw new Error(
        "zmx is not installed. Please install it from https://github.com/neurosnap/zmx"
      );
    }

    // Check macOS permissions on startup
    applescript.checkPermissions();
  }

  createSession(sessionName: string): { sessionName: string; windowId: number } {
    // Open Terminal with zmx session
    const windowId = applescript.openTerminalWithSession(sessionName);

    this.currentSession = sessionName;
    this.windowId = windowId;

    return { sessionName, windowId };
  }

  listSessions(): ZmxSession[] {
    return zmx.listSessions();
  }

  killSession(sessionName: string): void {
    zmx.killSession(sessionName);

    // If we killed the current session, clear state
    if (this.currentSession === sessionName) {
      this.currentSession = null;
      this.windowId = null;
    }
  }

  killAllSessions(): number {
    const count = zmx.killAllSessions();
    this.currentSession = null;
    this.windowId = null;
    return count;
  }

  sendKeys(keys: string[]): number {
    this.ensureTerminalActive();

    for (const key of keys) {
      applescript.sendKeystroke(key);
    }

    return keys.length;
  }

  typeText(text: string): number {
    this.ensureTerminalActive();
    applescript.typeText(text);
    return text.length;
  }

  getScreenText(): string {
    return applescript.getTerminalContent();
  }

  getScreenshot(): ScreenshotResult {
    // Try to get current window ID if we don't have one
    if (!this.windowId) {
      this.windowId = applescript.getTerminalWindowId();
    }

    if (!this.windowId) {
      throw new Error("No Terminal window is open");
    }

    return applescript.captureScreenshot(this.windowId);
  }

  getStatus(): SessionStatus {
    // Update window ID if needed
    if (!this.windowId) {
      this.windowId = applescript.getTerminalWindowId();
    }

    return {
      sessionName: this.currentSession,
      isActive: this.currentSession !== null,
      windowId: this.windowId,
      sessions: zmx.listSessions(),
    };
  }

  waitForText(
    text: string,
    timeoutMs: number = 5000
  ): { found: boolean; elapsedMs: number } {
    const startTime = Date.now();
    const pollInterval = 100;

    while (Date.now() - startTime < timeoutMs) {
      const content = this.getScreenText();
      if (content.includes(text)) {
        return { found: true, elapsedMs: Date.now() - startTime };
      }

      // Sleep for poll interval
      const sleepUntil = Date.now() + pollInterval;
      while (Date.now() < sleepUntil) {
        // Busy wait (Bun doesn't have sync sleep)
      }
    }

    return { found: false, elapsedMs: Date.now() - startTime };
  }

  waitForStable(
    timeoutMs: number = 5000,
    stableMs: number = 500
  ): { stable: boolean; elapsedMs: number } {
    const startTime = Date.now();
    const pollInterval = 100;
    let lastContent = this.getScreenText();
    let lastChangeTime = startTime;

    while (Date.now() - startTime < timeoutMs) {
      const content = this.getScreenText();

      if (content !== lastContent) {
        lastContent = content;
        lastChangeTime = Date.now();
      }

      if (Date.now() - lastChangeTime >= stableMs) {
        return { stable: true, elapsedMs: Date.now() - startTime };
      }

      // Sleep for poll interval
      const sleepUntil = Date.now() + pollInterval;
      while (Date.now() < sleepUntil) {
        // Busy wait
      }
    }

    return { stable: false, elapsedMs: Date.now() - startTime };
  }

  close(): void {
    if (this.windowId) {
      applescript.closeTerminalWindow();
    }
    this.currentSession = null;
    this.windowId = null;
  }

  resizeTerminal(rows: number, cols: number): void {
    applescript.resizeTerminal(rows, cols);
  }

  restartTerminal(command?: string): { sessionName: string; windowId: number } {
    // Close current window and kill session if exists
    if (this.windowId) {
      applescript.closeTerminalWindow();
    }
    if (this.currentSession) {
      try {
        zmx.killSession(this.currentSession);
      } catch {
        // Session may already be dead
      }
    }

    // Generate new session name or use provided command as basis
    const sessionName = command
      ? `poof-${Date.now()}`
      : this.currentSession || `poof-${Date.now()}`;

    // Open new terminal with session
    const windowId = applescript.openTerminalWithSession(sessionName);

    this.currentSession = sessionName;
    this.windowId = windowId;

    // If a custom command was provided, type it after the session starts
    if (command) {
      // Give zmx time to start
      const sleepUntil = Date.now() + 500;
      while (Date.now() < sleepUntil) {
        // Busy wait
      }
      applescript.typeText(command);
      applescript.sendKeystroke("enter");
    }

    return { sessionName, windowId };
  }

  private ensureTerminalActive(): void {
    applescript.activateTerminal();
  }
}
