# OpenCode Context — Obsidian Plugin

An Obsidian plugin that bridges workspace context to [OpenCode](https://opencode.ai) TUI.

It listens to Obsidian workspace events (open tabs, active file, selected text) and writes the state to `.opencode/obsidian-state.json`. The companion [OpenCode TUI plugin](../opencode-tui-plugin/) watches this file and displays the context in the terminal UI.

## How It Works

```
Obsidian workspace events
    ↓  (active-leaf-change, file-open, file-close, layout-change, editor-selection-change)
ContextManager (debounced)
    ↓
WorkspaceContext.gatherState()  →  { ts, active, tabs[], selection }
    ↓
.opencode/obsidian-state.json
    ↓
OpenCode TUI plugin reads file  →  displays tabs + injects context into AI session
```

## Requirements

- Desktop only (uses Node.js `fs` APIs)
- [OpenCode CLI](https://opencode.ai) installed
- The companion TUI plugin configured in `.opencode/tui.json`

## Installation

### Manual

1. Build the plugin:
   ```bash
   cd obsidian-plugin
   bun install && bun run build
   ```
2. Copy `main.js`, `manifest.json`, and `styles.css` to your vault's `.obsidian/plugins/opencode-context/` directory
3. Enable "OpenCode Context" in Obsidian Settings > Community Plugins

### TUI Plugin Setup

In your project's `.opencode/tui.json`, point to the TUI plugin:

```json
{
  "plugin": ["/path/to/opencode-tui-plugin/plugins/obsidian-tabs.tsx"]
}
```

## Settings

| Setting | Description | Default |
|---------|-------------|---------|
| Project directory | Working directory for OpenCode. Empty = vault root | (empty) |
| Inject workspace context | Enable/disable writing `obsidian-state.json` | On |
| Max notes in context | Limit how many open tabs are included | 20 |
| Max selection length | Truncate selected text beyond this length | 2000 |

## State File Format

The plugin writes `.opencode/obsidian-state.json` with this structure:

```json
{
  "ts": 1714400000000,
  "active": { "path": "notes/example.md", "name": "example.md" },
  "tabs": [
    { "path": "notes/example.md", "name": "example.md", "isActive": true },
    { "path": "notes/other.md", "name": "other.md", "isActive": false }
  ],
  "selection": {
    "text": "selected text content",
    "sourcePath": "notes/example.md"
  }
}
```
