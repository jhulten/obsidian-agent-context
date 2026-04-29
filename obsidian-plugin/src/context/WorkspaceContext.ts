import { App, MarkdownView } from "obsidian";
import { ObsidianState, SelectionInfo, TabInfo } from "../types";

export class WorkspaceContext {
  private app: App;
  private lastMarkdownView: MarkdownView | null = null;

  constructor(app: App) {
    this.app = app;
  }

  /** Cache the last active MarkdownView as a fallback. */
  trackActiveView(view: MarkdownView | null): void {
    if (view) {
      this.lastMarkdownView = view;
    }
  }

  /**
   * Gather workspace state as a JSON-serializable object
   * that matches the TUI plugin's ObsidianState type.
   */
  gatherState(maxNotes: number, maxSelectionLength: number): ObsidianState {
    const leaves = this.app.workspace.getLeavesOfType("markdown");
    const activeView =
      this.app.workspace.getActiveViewOfType(MarkdownView) ??
      this.lastMarkdownView;

    this.trackActiveView(activeView);

    const activePath = activeView?.file?.path ?? null;
    const activeName = activeView?.file?.name ?? null;

    // Collect open tabs
    const seen = new Set<string>();
    const tabs: TabInfo[] = [];

    for (const leaf of leaves) {
      const view = leaf.view as MarkdownView;
      const path = view.file?.path;
      const name = view.file?.name;
      if (path && name && !seen.has(path)) {
        seen.add(path);
        tabs.push({
          path,
          name,
          isActive: path === activePath,
        });
      }
      if (tabs.length >= maxNotes) break;
    }

    // Capture selected text from the active editor
    let selection: SelectionInfo | null = null;
    if (activeView) {
      const rawSelection = activeView.editor?.getSelection() ?? "";
      const sourcePath = activeView.file?.path;
      if (sourcePath && rawSelection.trim()) {
        let text = rawSelection;
        if (text.length > maxSelectionLength) {
          text = text.slice(0, maxSelectionLength) + "... [truncated]";
        }
        selection = { text, sourcePath };
      }
    }

    return {
      ts: Date.now(),
      active: activePath && activeName
        ? { path: activePath, name: activeName }
        : null,
      tabs,
      selection,
    };
  }
}
