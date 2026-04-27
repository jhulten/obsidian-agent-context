# opencode-obsidian-plugin

Plugins for integrating [OpenCode](https://opencode.ai) with [Obsidian](https://obsidian.md).

## Structure

- **obsidian-plugin/** — Obsidian plugin that embeds OpenCode in Obsidian and injects workspace context (open files, selections) into AI sessions.
- **opencode-tui-plugin/** — OpenCode TUI plugin that displays Obsidian tab state in the terminal UI and injects open-page context into sessions.

## Setup

### Obsidian Plugin

```bash
cd obsidian-plugin
npm install
npm run build
```

### OpenCode TUI Plugin

```bash
cd opencode-tui-plugin
npm install
```

Then reference the plugin in your project's `.opencode/tui.json`:

```json
{
  "plugin": ["<path-to>/opencode-tui-plugin/plugins/obsidian-tabs.tsx"]
}
```
