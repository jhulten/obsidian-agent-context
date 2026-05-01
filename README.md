# Agent Context — Obsidian Plugin

An Obsidian plugin that records workspace state (open tabs, active file, selected text) to `.obsidian/context.json`. External AI agents and tools can read this file to understand the user's current workspace context.

Desktop only.

## How It Works

```
Obsidian workspace events
    |  (active-leaf-change, file-open, file-close, layout-change, editor-selection-change)
    v
ContextManager (debounced)
    |
    v
WorkspaceContext.gatherState()  ->  { ts, active, tabs[], selection }
    |
    v
.obsidian/context.json
```

## Installation

1. Build:
   ```bash
   npm install && npm run build
   ```
2. Copy `main.js`, `manifest.json`, and `styles.css` to your vault's `.obsidian/plugins/agent-context/`
3. Enable "Agent Context" in Obsidian Settings > Community Plugins

## Settings

| Setting | Description | Default |
|---------|-------------|---------|
| Inject workspace context | Enable/disable writing `context.json` | On |
| Max notes in context | Limit how many open tabs are included | 20 |
| Max selection length | Truncate selected text beyond this length | 2000 |

## State File Format

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
