/** @jsxImportSource @opentui/solid */
import type { TuiPlugin, TuiPluginApi, TuiPluginModule } from "@opencode-ai/plugin/tui"
import { createMemo } from "solid-js"
import { createStore, reconcile } from "solid-js/store"
import { watch, readFileSync, existsSync } from "fs"
import { join } from "path"

const id = "obsidian-tabs"

// ── Types matching obsidian-state.json ──

type TabInfo = {
  path: string
  name: string
  isActive: boolean
}

type SelectionInfo = {
  text: string
  sourcePath: string
}

type ObsidianState = {
  ts: number
  active: { path: string; name: string } | null
  tabs: TabInfo[]
  selection: SelectionInfo | null
}

const EMPTY: ObsidianState = { ts: 0, active: null, tabs: [], selection: null }

// ── File watcher ──

function watchStateFile(
  directory: string,
  onChange: (state: ObsidianState) => void,
  signal: AbortSignal,
) {
  const file = join(directory, ".opencode", "obsidian-state.json")

  const read = () => {
    try {
      if (!existsSync(file)) return
      const raw = readFileSync(file, "utf-8")
      const parsed = JSON.parse(raw) as ObsidianState
      if (parsed && typeof parsed.ts === "number") {
        onChange(parsed)
      }
    } catch {
      // File may be partially written — ignore and wait for next event
    }
  }

  // Initial read
  read()

  // Watch for changes
  try {
    const watcher = watch(file, { persistent: false }, () => read())
    const abort = () => watcher.close()
    signal.addEventListener("abort", abort, { once: true })
  } catch {
    // File doesn't exist yet — poll until it appears, then watch
    const interval = setInterval(() => {
      if (signal.aborted) {
        clearInterval(interval)
        return
      }
      if (existsSync(file)) {
        clearInterval(interval)
        read()
        try {
          const watcher = watch(file, { persistent: false }, () => read())
          signal.addEventListener("abort", () => watcher.close(), { once: true })
        } catch { /* ignore */ }
      }
    }, 2000)
    signal.addEventListener("abort", () => clearInterval(interval), { once: true })
  }
}

// ── UI component ──

function TabsBar(props: { api: TuiPluginApi; state: ObsidianState }) {
  const theme = () => props.api.theme.current

  const display = createMemo(() => {
    const s = props.state
    if (s.tabs.length === 0 && !s.active) return null

    const activeName = s.active?.name ?? null
    const otherCount = activeName
      ? s.tabs.filter((t) => !t.isActive).length
      : s.tabs.length
    const hasSelection = !!(s.selection && s.selection.text.trim())

    return { activeName, otherCount, total: s.tabs.length, hasSelection }
  })

  return (
    <>
      {display() ? (
        <box flexDirection="row" paddingLeft={2} paddingRight={2}>
          <text>
            <span style={{ fg: theme().textMuted }}>Obsidian </span>
            {display()!.activeName ? (
              <>
                <span style={{ fg: theme().primary }}>
                  <b>{display()!.activeName}</b>
                </span>
                {display()!.otherCount > 0 ? (
                  <span style={{ fg: theme().textMuted }}>
                    {" "}+ {display()!.otherCount} pages
                  </span>
                ) : null}
              </>
            ) : (
              <span style={{ fg: theme().textMuted }}>
                {display()!.total} pages
              </span>
            )}
            {display()!.hasSelection ? (
              <span style={{ fg: theme().secondary }}>
                {" "}[selection]
              </span>
            ) : null}
          </text>
        </box>
      ) : null}
    </>
  )
}

// ── Plugin entry ──

const tui: TuiPlugin = async (api) => {
  const directory = api.state.path.directory || process.cwd()

  // Reactive store for Obsidian state
  const [state, setState] = createStore<ObsidianState>({ ...EMPTY })

  // Watch the JSON file for changes (driven by Obsidian plugin)
  watchStateFile(
    directory,
    (next) => setState(reconcile(next)),
    api.lifecycle.signal,
  )

  // ── UI: show tabs bar above the prompt input ──
  api.slots.register({
    order: 50,
    slots: {
      session_prompt_above() {
        return <TabsBar api={api} state={state} />
      },
    },
  })

  // ── Prompt injection on session start ──
  const injected = new Map<string, number>() // sessionID -> last injected ts

  api.event.on("session.status", async (evt) => {
    const { sessionID, status } = evt.properties
    const statusType =
      typeof status === "object" && status !== null
        ? (status as { type: string }).type
        : String(status)

    if (statusType !== "running") return

    const s = state
    if (s.tabs.length === 0 && !s.active) return

    // Only inject if tabs changed since last injection for this session
    if (injected.get(sessionID) === s.ts) return
    injected.set(sessionID, s.ts)

    // Build context
    const lines: string[] = []
    lines.push("<system-reminder>")
    lines.push("The user has the following files open in Obsidian:")
    if (s.active) {
      lines.push(`Currently viewing: ${s.active.path}`)
    }
    lines.push("All open tabs:")
    for (const tab of s.tabs) {
      const marker = tab.isActive ? " (active)" : ""
      lines.push(`  - ${tab.path}${marker}`)
    }
    if (s.selection && s.selection.text.trim()) {
      lines.push("")
      lines.push(`Selected text (from ${s.selection.sourcePath}):`)
      lines.push('"""')
      lines.push(s.selection.text)
      lines.push('"""')
    }
    lines.push("Use this context to understand what the user is working on.")
    lines.push("</system-reminder>")

    try {
      await api.client.session.prompt({
        sessionID,
        noReply: true,
        parts: [{ type: "text", text: lines.join("\n") }],
      })
    } catch {
      // Session may have ended
    }
  })
}

const plugin: TuiPluginModule & { id: string } = {
  id,
  tui,
}

export default plugin
