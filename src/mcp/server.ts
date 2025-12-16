import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { TerminalManager } from "../terminal/manager";

export function createMcpServer(
  terminalManager: TerminalManager,
  version: string
): McpServer {
  const server = new McpServer(
    {
      name: "poof-mcp",
      version,
    },
    {
      capabilities: {
        tools: {},
      },
      instructions: `AI-controllable terminal server using zmx sessions and AppleScript.

This server allows you to:
- Create and manage terminal sessions via zmx
- Open sessions in visible Terminal.app windows
- Send keystrokes and type text into the terminal
- Read terminal screen content
- Capture screenshots of Terminal windows

Use create_session to start a new terminal session, then interact with it using send_keystrokes, type_text, get_screen_text, and get_screenshot.`,
    }
  );

  // Tool: send_keystrokes
  server.tool(
    "send_keystrokes",
    "Send key presses (e.g., ['enter'], ['up', 'up', 'enter'])",
    {
      keys: z
        .array(z.string())
        .describe(
          "Array of keys to send. Examples: ['enter'], ['up', 'up', 'enter'], ['ctrl+c']"
        ),
    },
    async ({ keys }) => {
      try {
        const count = terminalManager.sendKeys(keys);
        return {
          content: [
            {
              type: "text" as const,
              text: `Sent ${count} keystroke(s)`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error sending keystrokes: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Tool: type_text
  server.tool(
    "type_text",
    "Type a string",
    {
      text: z.string().describe("Text to type into the terminal"),
    },
    async ({ text }) => {
      try {
        const count = terminalManager.typeText(text);
        return {
          content: [
            {
              type: "text" as const,
              text: `Typed ${count} character(s)`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error typing text: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Tool: get_screenshot
  server.tool(
    "get_screenshot",
    "Get screen as base64 JPEG. Opens the terminal if not already open.",
    {
      session_name: z.string().describe("Name of the session to capture"),
    },
    async ({ session_name }) => {
      try {
        const screenshot = terminalManager.getScreenshot(session_name);
        return {
          content: [
            {
              type: "image" as const,
              data: screenshot.data,
              mimeType: screenshot.mimeType,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error capturing screenshot: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Tool: get_screen_text
  server.tool(
    "get_screen_text",
    "Get screen as plain text. Opens the terminal if not already open.",
    {
      session_name: z.string().describe("Name of the session to read"),
    },
    async ({ session_name }) => {
      try {
        const text = terminalManager.getScreenText(session_name);
        return {
          content: [
            {
              type: "text" as const,
              text: text || "(empty screen)",
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error getting screen text: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Tool: get_status
  server.tool(
    "get_status",
    "Get terminal status",
    {},
    async () => {
      try {
        const status = terminalManager.getStatus();
        const lines = [
          `Current session: ${status.sessionName || "(none)"}`,
          `Active: ${status.isActive}`,
          `Window ID: ${status.windowId || "(none)"}`,
          `Total sessions: ${status.sessions.length}`,
        ];
        if (status.sessions.length > 0) {
          lines.push("Sessions:");
          status.sessions.forEach((s) => {
            lines.push(`  - ${s.name}`);
          });
        }
        return {
          content: [
            {
              type: "text" as const,
              text: lines.join("\n"),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error getting status: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Tool: list_sessions
  server.tool(
    "list_sessions",
    "List active sessions",
    {},
    async () => {
      try {
        const sessions = terminalManager.listSessions();
        if (sessions.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: "No active sessions",
              },
            ],
          };
        }
        const sessionList = sessions
          .map(
            (s, i) =>
              `${i + 1}. ${s.name}${s.pid ? ` (PID: ${s.pid})` : ""}${s.clients ? ` [${s.clients} client(s)]` : ""}`
          )
          .join("\n");
        return {
          content: [
            {
              type: "text" as const,
              text: `Active sessions:\n${sessionList}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error listing sessions: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Tool: kill_session
  server.tool(
    "kill_session",
    "Kill a session",
    {
      session_name: z.string().describe("Name of the session to kill"),
    },
    async ({ session_name }) => {
      try {
        terminalManager.killSession(session_name);
        return {
          content: [
            {
              type: "text" as const,
              text: `Killed session "${session_name}"`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error killing session: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Tool: create_session
  server.tool(
    "create_session",
    "Create new zmx session + open Terminal.app",
    {
      session_name: z
        .string()
        .describe("Name for the new session (e.g., 'dev', 'test')"),
    },
    async ({ session_name }) => {
      try {
        const result = terminalManager.createSession(session_name);
        return {
          content: [
            {
              type: "text" as const,
              text: `Created session "${result.sessionName}" with window ID ${result.windowId}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error creating session: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Tool: resize_terminal
  server.tool(
    "resize_terminal",
    "Resize the terminal",
    {
      rows: z.number().describe("Number of rows"),
      cols: z.number().describe("Number of columns"),
    },
    async ({ rows, cols }) => {
      try {
        terminalManager.resizeTerminal(rows, cols);
        return {
          content: [
            {
              type: "text" as const,
              text: `Resized terminal to ${rows} rows x ${cols} columns`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error resizing terminal: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Tool: restart_terminal
  server.tool(
    "restart_terminal",
    "Restart the terminal (optionally with a new command)",
    {
      command: z
        .string()
        .optional()
        .describe("Optional command to run in the new terminal"),
    },
    async ({ command }) => {
      try {
        const result = terminalManager.restartTerminal(command);
        const msg = command
          ? `Restarted terminal with command "${command}" (session: ${result.sessionName})`
          : `Restarted terminal (session: ${result.sessionName})`;
        return {
          content: [
            {
              type: "text" as const,
              text: msg,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error restarting terminal: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Tool: wait_for_text
  server.tool(
    "wait_for_text",
    "Wait for text to appear on screen (5s default timeout)",
    {
      text: z.string().describe("Text to wait for"),
      timeout_ms: z
        .number()
        .optional()
        .default(5000)
        .describe("Maximum time to wait in milliseconds (default: 5000)"),
    },
    async ({ text, timeout_ms }) => {
      try {
        const result = terminalManager.waitForText(text, timeout_ms);
        return {
          content: [
            {
              type: "text" as const,
              text: result.found
                ? `Text "${text}" found after ${result.elapsedMs}ms`
                : `Text "${text}" not found within ${timeout_ms}ms`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error waiting for text: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Tool: wait_for_stable
  server.tool(
    "wait_for_stable",
    "Wait for screen to stop changing (500ms stable duration)",
    {
      timeout_ms: z
        .number()
        .optional()
        .default(5000)
        .describe("Maximum time to wait in milliseconds (default: 5000)"),
      stable_ms: z
        .number()
        .optional()
        .default(500)
        .describe(
          "Time the screen must remain unchanged to be considered stable (default: 500)"
        ),
    },
    async ({ timeout_ms, stable_ms }) => {
      try {
        const result = terminalManager.waitForStable(timeout_ms, stable_ms);
        return {
          content: [
            {
              type: "text" as const,
              text: result.stable
                ? `Screen stabilized after ${result.elapsedMs}ms`
                : `Screen did not stabilize within ${timeout_ms}ms`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error waiting for stable: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  return server;
}
