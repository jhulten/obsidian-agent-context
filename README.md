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

### From Community Plugins

1. Open Obsidian Settings > Community Plugins
2. Search for "Agent Context"
3. Click Install, then Enable

### Manual Installation

1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](https://github.com/xuezhaojun/obsidian-agent-context/releases/latest)
2. Create a folder `.obsidian/plugins/agent-context/` in your vault
3. Copy the downloaded files into that folder
4. Restart Obsidian and enable "Agent Context" in Settings > Community Plugins

### Build from Source

1. Clone this repository and build:
   ```bash
   git clone https://github.com/xuezhaojun/obsidian-agent-context.git
   cd obsidian-agent-context
   npm install && npm run build
   ```
2. Copy `main.js`, `manifest.json`, and `styles.css` to your vault's `.obsidian/plugins/agent-context/`
3. Restart Obsidian and enable "Agent Context" in Settings > Community Plugins

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
