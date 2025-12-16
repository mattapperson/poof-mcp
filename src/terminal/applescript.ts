import { execSync } from "child_process";
import { readFileSync, unlinkSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { screenshot } from "screenshot-ftw";
import { getAuthStatus, askForScreenCaptureAccess, askForAccessibilityAccess } from "node-mac-permissions";

const PERMISSIONS_ERROR_MESSAGE = `
┌─────────────────────────────────────────────────────────────────────┐
│  PERMISSIONS REQUIRED                                               │
├─────────────────────────────────────────────────────────────────────┤
│  poof-mcp needs macOS permissions to control Terminal.app           │
│                                                                     │
│  To fix this:                                                       │
│                                                                     │
│  1. Open System Settings → Privacy & Security → Accessibility       │
│     • Add and enable the app running this MCP server                │
│       (e.g., Claude, Terminal, iTerm2, VS Code)                     │
│                                                                     │
│  2. Open System Settings → Privacy & Security → Automation          │
│     • Allow the app to control "Terminal.app"                       │
│                                                                     │
│  3. If prompted with a dialog, click "OK" or "Allow"                │
│                                                                     │
│  After granting permissions, restart the MCP server.                │
└─────────────────────────────────────────────────────────────────────┘
`.trim();

class PermissionsError extends Error {
  constructor() {
    super(PERMISSIONS_ERROR_MESSAGE);
    this.name = "PermissionsError";
  }
}

function runAppleScript(script: string, timeoutMs: number = 5000): string {
  try {
    const result = execSync(`osascript -e '${script.replace(/'/g, "'\"'\"'")}'`, {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
      timeout: timeoutMs,
    });
    return result.trim();
  } catch (error: unknown) {
    if (error && typeof error === "object") {
      // Check for timeout (happens when waiting for permissions dialog)
      if ("killed" in error && error.killed) {
        throw new PermissionsError();
      }
      if ("signal" in error && error.signal === "SIGTERM") {
        throw new PermissionsError();
      }
      if ("stderr" in error) {
        const stderr = (error as { stderr: string }).stderr;
        // Check for common permission-related errors
        if (stderr.includes("not allowed") || stderr.includes("assistive access") || stderr.includes("permission")) {
          throw new PermissionsError();
        }
        throw new Error(`AppleScript error: ${stderr}`);
      }
    }
    throw error;
  }
}

function runMultilineAppleScript(script: string, timeoutMs: number = 5000): string {
  try {
    // For multiline scripts, pass via stdin
    const result = execSync("osascript", {
      input: script,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
      timeout: timeoutMs,
    });
    return result.trim();
  } catch (error: unknown) {
    if (error && typeof error === "object") {
      // Check for timeout (happens when waiting for permissions dialog)
      if ("killed" in error && error.killed) {
        throw new PermissionsError();
      }
      if ("signal" in error && error.signal === "SIGTERM") {
        throw new PermissionsError();
      }
      if ("stderr" in error) {
        const stderr = (error as { stderr: string }).stderr;
        // Check for common permission-related errors
        if (stderr.includes("not allowed") || stderr.includes("assistive access") || stderr.includes("permission")) {
          throw new PermissionsError();
        }
        throw new Error(`AppleScript error: ${stderr}`);
      }
    }
    throw error;
  }
}

/**
 * Check if we have the necessary macOS permissions to control Terminal.app
 * Returns true if permissions are granted, throws PermissionsError if not
 */
export function checkPermissions(): boolean {
  try {
    // Simple test: try to get Terminal's name (doesn't require a window)
    runAppleScript('tell application "Terminal" to return name', 3000);
    return true;
  } catch (error) {
    if (error instanceof PermissionsError) {
      throw error;
    }
    // If it's another error, permissions might still be the issue
    throw new PermissionsError();
  }
}

export function openTerminalWithSession(sessionName: string): number {
  const script = `
tell application "Terminal"
    activate
    set newTab to do script "zmx attach ${sessionName}"
    delay 0.5
    return id of front window
end tell
`;
  const windowId = runMultilineAppleScript(script);
  return parseInt(windowId, 10);
}

export function getTerminalWindowId(): number | null {
  try {
    const script = `
tell application "Terminal"
    if (count of windows) > 0 then
        return id of front window
    else
        return -1
    end if
end tell
`;
    const result = runMultilineAppleScript(script);
    const id = parseInt(result, 10);
    return id > 0 ? id : null;
  } catch {
    return null;
  }
}

export function activateTerminal(): void {
  runAppleScript('tell application "Terminal" to activate');
}

export function getTerminalContent(): string {
  const script = `
tell application "Terminal"
    if (count of windows) > 0 then
        return contents of selected tab of front window
    else
        return ""
    end if
end tell
`;
  return runMultilineAppleScript(script);
}

export function typeText(text: string): void {
  // Escape special characters for AppleScript
  const escaped = text
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"');

  const script = `
tell application "System Events"
    tell process "Terminal"
        keystroke "${escaped}"
    end tell
end tell
`;
  runMultilineAppleScript(script);
}

// Key code mappings for special keys
const KEY_CODES: Record<string, number> = {
  enter: 36,
  return: 36,
  tab: 48,
  escape: 53,
  esc: 53,
  space: 49,
  delete: 51,
  backspace: 51,
  up: 126,
  down: 125,
  left: 123,
  right: 124,
  home: 115,
  end: 119,
  pageup: 116,
  pagedown: 121,
  f1: 122,
  f2: 120,
  f3: 99,
  f4: 118,
  f5: 96,
  f6: 97,
  f7: 98,
  f8: 100,
  f9: 101,
  f10: 109,
  f11: 103,
  f12: 111,
};

export function sendKeystroke(key: string): void {
  const lowerKey = key.toLowerCase();

  // Handle modifier combinations like "ctrl+c", "alt+f", "shift+a"
  if (key.includes("+")) {
    const parts = key.split("+");
    const modifier = parts[0].toLowerCase();
    const mainKey = parts[1];

    let modifierClause = "";
    switch (modifier) {
      case "ctrl":
      case "control":
        modifierClause = "using control down";
        break;
      case "alt":
      case "option":
        modifierClause = "using option down";
        break;
      case "shift":
        modifierClause = "using shift down";
        break;
      case "cmd":
      case "command":
        modifierClause = "using command down";
        break;
      default:
        throw new Error(`Unknown modifier: ${modifier}`);
    }

    // Check if mainKey is a special key or a character
    const keyCode = KEY_CODES[mainKey.toLowerCase()];
    let script: string;

    if (keyCode !== undefined) {
      script = `
tell application "System Events"
    tell process "Terminal"
        key code ${keyCode} ${modifierClause}
    end tell
end tell
`;
    } else if (mainKey.length === 1) {
      script = `
tell application "System Events"
    tell process "Terminal"
        keystroke "${mainKey}" ${modifierClause}
    end tell
end tell
`;
    } else {
      throw new Error(`Unknown key: ${mainKey}`);
    }

    runMultilineAppleScript(script);
    return;
  }

  // Handle special keys
  const keyCode = KEY_CODES[lowerKey];
  if (keyCode !== undefined) {
    const script = `
tell application "System Events"
    tell process "Terminal"
        key code ${keyCode}
    end tell
end tell
`;
    runMultilineAppleScript(script);
    return;
  }

  // Handle single character
  if (key.length === 1) {
    typeText(key);
    return;
  }

  throw new Error(`Unknown key: ${key}`);
}

const SCREEN_RECORDING_ERROR = `
Screenshot failed - Screen Recording permission required.

The HOST APPLICATION running this MCP server needs Screen Recording permission.
This is typically Claude Desktop, VS Code, or Terminal - not the MCP server itself.

To fix this:
1. System Settings should have opened automatically
2. Find and enable the app you're using (e.g., "Claude" or "Code")
3. You may need to restart that app after granting permission

Alternative: Use get_screen_text tool instead (no permission required)
`.trim();

/**
 * Check if Screen Recording permission is granted.
 * Returns the status: 'authorized', 'denied', 'not determined', or 'restricted'
 */
export function getScreenRecordingStatus(): string {
  return getAuthStatus("screen");
}

/**
 * Request Screen Recording permission.
 * On first call, shows the native permission dialog.
 * On subsequent calls (if denied), opens System Settings.
 */
export function requestScreenRecordingAccess(): void {
  askForScreenCaptureAccess();
}

/**
 * Check if Accessibility permission is granted.
 * Returns the status: 'authorized', 'denied', 'not determined', or 'restricted'
 */
export function getAccessibilityStatus(): string {
  return getAuthStatus("accessibility");
}

/**
 * Request Accessibility permission (opens System Settings).
 */
export function requestAccessibilityAccess(): void {
  askForAccessibilityAccess();
}

function getTerminalCGWindowId(): number | null {
  try {
    // Use Swift to get the CGWindowID for Terminal's front window
    // CGWindowID is different from AppleScript's window ID and is required for screencapture
    const result = execSync(
      `swift -e 'import Cocoa; let opts = CGWindowListOption(arrayLiteral: .optionOnScreenOnly); if let list = CGWindowListCopyWindowInfo(opts, kCGNullWindowID) as? [[String: Any]] { for w in list { if let owner = w["kCGWindowOwnerName"] as? String, owner == "Terminal", let layer = w["kCGWindowLayer"] as? Int, layer == 0, let id = w["kCGWindowNumber"] as? Int { print(id); break } } }'`,
      { encoding: "utf-8", timeout: 5000 }
    ).trim();
    return result ? parseInt(result, 10) : null;
  } catch {
    return null;
  }
}

export async function captureScreenshot(): Promise<{ data: string; mimeType: string }> {
  const tmpFile = join(tmpdir(), `poof-mcp-screenshot-${Date.now()}.png`);

  // First, make sure Terminal is frontmost
  activateTerminal();

  try {
    // Get the CGWindowID for Terminal's front window
    const windowId = getTerminalCGWindowId();
    if (!windowId) {
      throw new Error("Could not find Terminal window. Make sure Terminal is open.");
    }

    // Use screenshot-ftw to capture by window ID
    // This will trigger the native permission dialog on first attempt
    await screenshot.captureWindowById(tmpFile, windowId);

    // Read the file and convert to base64
    const buffer = readFileSync(tmpFile);
    const base64 = buffer.toString("base64");

    return {
      data: base64,
      mimeType: "image/png",
    };
  } catch (e: unknown) {
    // screenshot-ftw returns {code, stdout, stderr} on error
    let errMsg: string;
    if (e && typeof e === "object" && "stdout" in e) {
      const result = e as { code: number; stdout: string; stderr: string };
      errMsg = result.stdout || result.stderr || `Exit code ${result.code}`;
    } else if (e instanceof Error) {
      errMsg = e.message;
    } else {
      errMsg = String(e);
    }

    // Check if it's a permission issue
    if (errMsg.includes("could not create image") || errMsg.includes("permission")) {
      // Open System Settings to the Screen Recording panel
      requestScreenRecordingAccess();
      throw new Error(
        SCREEN_RECORDING_ERROR +
          "\n\nSystem Settings has been opened to the Screen Recording panel."
      );
    }
    throw new Error(`Could not capture screenshot: ${errMsg}`);
  } finally {
    // Clean up temp file
    try {
      unlinkSync(tmpFile);
    } catch {
      // Ignore cleanup errors
    }
  }
}

export function closeTerminalWindow(): void {
  const script = `
tell application "Terminal"
    if (count of windows) > 0 then
        close front window
    end if
end tell
`;
  runMultilineAppleScript(script);
}

export function resizeTerminal(rows: number, cols: number): void {
  const script = `
tell application "Terminal"
    if (count of windows) > 0 then
        set number of rows of front window to ${rows}
        set number of columns of front window to ${cols}
    end if
end tell
`;
  runMultilineAppleScript(script);
}
