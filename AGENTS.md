# AGENTS.md - Agent Context Plugin

Guidelines for AI coding agents working on this Obsidian plugin.

## Project Overview

Obsidian plugin that records workspace state (open tabs, active file, selected text) to `.obsidian/context.json`. External tools can read this file to understand the user's current workspace context.

**Tech Stack:** TypeScript, Obsidian Plugin API, esbuild, Node.js `fs`

## Build Commands

```bash
npm install          # Install dependencies
npm run build        # Production (type-check + bundle)
npm run lint         # ESLint with eslint-plugin-obsidianmd (Obsidian-required checks)
```

Output: `main.js` (CommonJS bundle)

## Mandatory Checks

**Every code change MUST be verified with the Obsidian-required lint tool before being considered complete.**

Run `npm run lint` after any modification to source files. This executes ESLint configured with `eslint-plugin-obsidianmd` (the lint plugin required by Obsidian's plugin guidelines, see https://github.com/obsidianmd/eslint-plugin). Resolve all reported errors and warnings before finishing the task.

## Project Structure

```
src/
├── main.ts                        # Plugin entry, extends Plugin
├── types.ts                       # Settings, ObsidianState types
├── settings/
│   └── SettingsTab.ts             # Settings UI (PluginSettingTab)
└── context/
    ├── ContextManager.ts          # Event listeners + writes JSON file
    └── WorkspaceContext.ts        # Gathers workspace state (tabs, selection)
```

## Coding Guidelines

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Classes | PascalCase | `ContextPlugin`, `ContextManager` |
| Interfaces/Types | PascalCase | `PluginSettings`, `ObsidianState` |
| Constants | UPPER_CASE or camelCase | `DEFAULT_SETTINGS` |
| Variables/functions | camelCase | `gatherState`, `writeState` |
| Private members | camelCase (no prefix) | `private contextManager` |
| Files | PascalCase (classes), lowercase (entry) | `ContextManager.ts`, `main.ts` |

### TypeScript Patterns
- `strictNullChecks` enabled — handle null/undefined
- `async/await` over Promises
- Explicit return types on public methods

### Obsidian API Patterns
- Extend `Plugin` with `onload()`/`onunload()` lifecycle
- Extend `PluginSettingTab` for settings: `display()`
- Register events in `onload()`, clean up in `onunload()`/`destroy()`

## Config Summary

**tsconfig.json:** ES6 target, ESNext modules, strictNullChecks, noImplicitAny

**esbuild:** CJS format, es2018 target, node platform. Externals: obsidian, electron, CodeMirror, Node builtins

## Desktop-Only

Uses Node.js APIs unavailable on mobile:
- `fs.writeFile()` for writing state JSON
- `fs.existsSync()` / `fs.mkdirSync()` for directory creation
