#!/usr/bin/env bun

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { TerminalManager } from "./terminal/manager";
import { createMcpServer } from "./mcp/server";

const VERSION = "1.0.0";

function showHelp(): void {
  console.log(`
poof-mcp v${VERSION} - MCP server for AI terminal control

USAGE:
  poof-mcp              Start the MCP server (stdio transport)
  poof-mcp --help       Show this help
  poof-mcp --version    Show version

DESCRIPTION:
  This MCP server allows AI agents to control terminal sessions via:
  - zmx for session management
  - AppleScript for Terminal.app control
  - Screenshots for visual feedback

  Sessions are opened in visible Terminal.app windows.

MCP TOOLS:
  send_keystrokes   Send key presses (e.g., ["enter"], ["up", "up", "enter"])
  type_text         Type a string
  get_screenshot    Get screen as base64 JPEG
  get_screen_text   Get screen as plain text
  get_status        Get terminal status
  list_sessions     List active sessions
  kill_session      Kill a session
  create_session    Create new zmx session + open Terminal.app
  resize_terminal   Resize the terminal
  restart_terminal  Restart the terminal (optionally with a new command)
  wait_for_text     Wait for text to appear on screen (5s default timeout)
  wait_for_stable   Wait for screen to stop changing (500ms stable duration)

REQUIREMENTS:
  - zmx (https://github.com/neurosnap/zmx)
  - macOS with Terminal.app
`);
}

function showVersion(): void {
  console.log(`poof-mcp v${VERSION}`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    showHelp();
    process.exit(0);
  }

  if (args.includes("--version") || args.includes("-v")) {
    showVersion();
    process.exit(0);
  }

  // Create terminal manager
  let terminalManager: TerminalManager;
  try {
    terminalManager = new TerminalManager();
  } catch (error) {
    console.error(
      `Error: ${error instanceof Error ? error.message : String(error)}`
    );
    process.exit(1);
  }

  // Create MCP server
  const server = createMcpServer(terminalManager, VERSION);

  // Create stdio transport
  const transport = new StdioServerTransport();

  // Handle shutdown gracefully
  process.on("SIGINT", async () => {
    terminalManager.close();
    await server.close();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    terminalManager.close();
    await server.close();
    process.exit(0);
  });

  // Connect and start
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
