# poof-mcp

An MCP (Model Context Protocol) server that provides AI agents with real terminal control capabilities on macOS.

## Features

- **Terminal session management** via zmx
- **Visible Terminal.app windows** - watch the AI work in real-time
- **Keystroke control** - send individual keys or modifier combinations
- **Text typing** - fast text input
- **Screen capture** - get terminal text or JPEG screenshots
- **Wait helpers** - wait for text or screen stability
- **Resize & restart** - control terminal dimensions and restart sessions

## Prerequisites

### 1. zmx - Terminal session manager

```bash
# macOS (Apple Silicon)
curl -LO https://zmx.sh/a/zmx-0.0.2-macos-aarch64.tar.gz
tar -xzf zmx-0.0.2-macos-aarch64.tar.gz
mv zmx ~/.local/bin/

# macOS (Intel)
curl -LO https://zmx.sh/a/zmx-0.0.2-macos-x86_64.tar.gz
tar -xzf zmx-0.0.2-macos-x86_64.tar.gz
mv zmx ~/.local/bin/
```

### 2. macOS Permissions

poof-mcp uses AppleScript and screencapture to control Terminal.app, which requires permissions:

1. **System Settings → Privacy & Security → Accessibility**
   - Add and enable the app running the MCP server (e.g., Claude, Terminal, iTerm2, VS Code)

2. **System Settings → Privacy & Security → Automation**
   - Allow the app to control **Terminal.app**

3. **System Settings → Privacy & Security → Screen Recording** (for screenshots)
   - Add and enable the app running the MCP server
   - Required only for `get_screenshot` tool; `get_screen_text` works without this

4. If prompted with a permissions dialog, click **OK** or **Allow**

> **Note**: The MCP server returns clear error messages when permissions are missing.

## Installation

```bash
# Install dependencies
bun install

# Build standalone executable
bun run build
```

## Usage

### As an MCP Server

Add to your Claude Code MCP configuration:

```bash
claude mcp add poof-mcp -- /path/to/poof-mcp
```

Or add to `~/.claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "poof-mcp": {
      "command": "/path/to/poof-mcp"
    }
  }
}
```

### CLI

```bash
poof-mcp --help     # Show help
poof-mcp --version  # Show version
poof-mcp            # Start MCP server (stdio)
```

## MCP Tools

| Tool | Description |
|------|-------------|
| `send_keystrokes` | Send key presses (e.g., `["enter"]`, `["up", "up", "enter"]`) |
| `type_text` | Type a string |
| `get_screenshot` | Get screen as base64 JPEG |
| `get_screen_text` | Get screen as plain text |
| `get_status` | Get terminal status |
| `list_sessions` | List active sessions |
| `kill_session` | Kill a session |
| `create_session` | Create new zmx session + open Terminal.app |
| `resize_terminal` | Resize the terminal |
| `restart_terminal` | Restart the terminal (optionally with a new command) |
| `wait_for_text` | Wait for text to appear on screen (5s default timeout) |
| `wait_for_stable` | Wait for screen to stop changing (500ms stable duration) |

### Keystroke Examples

The `send_keystrokes` tool supports:
- Single characters: `a`, `b`, `1`, etc.
- Special keys: `enter`, `tab`, `escape`, `space`, `backspace`
- Arrow keys: `up`, `down`, `left`, `right`
- Function keys: `f1` through `f12`
- Modifiers: `ctrl+c`, `alt+f`, `shift+a`, `cmd+v`

## Development

```bash
# Run in development mode
bun run dev

# Build executable
bun run build
```

## Architecture

```
Claude Code (AI Agent)
    ↓ (JSON-RPC over stdio)
MCP Server (TypeScript/Bun)
    ↓
Terminal Manager
    ├── zmx commands (session management)
    └── AppleScript (Terminal.app control)
        ↓
macOS Terminal.app + zmx session
```

## How It Works

1. **Session Management**: Uses [zmx](https://github.com/neurosnap/zmx) for terminal session persistence
2. **Terminal Control**: AppleScript controls macOS Terminal.app for keystrokes and text input
3. **Screen Capture**: `screencapture` command captures Terminal window as JPEG
4. **Text Extraction**: AppleScript reads Terminal.app content directly

## License

MIT
