import { App, MarkdownView, View, WorkspaceLeaf } from "obsidian";
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
   * that conforms to the ObsidianState type.
   */
  gatherState(maxNotes: number, maxSelectionLength: number): ObsidianState {
    const activeView =
      this.app.workspace.getActiveViewOfType(MarkdownView) ??
      this.lastMarkdownView;

    this.trackActiveView(activeView);

    const activePath = activeView?.file?.path ?? null;
    const activeName = activeView?.file?.name ?? null;

    // Collect all open tabs by iterating all leaves in the workspace
    const seen = new Set<string>();
    const tabs: TabInfo[] = [];

    this.app.workspace.iterateAllLeaves((leaf: WorkspaceLeaf) => {
      // Get the file from the leaf's view state, works for all view types
      const file = (leaf.view as View & { file?: { path: string; name: string } })?.file;
      const path = file?.path;
      const name = file?.name;
      if (path && name && !seen.has(path)) {
        seen.add(path);
        tabs.push({
          path,
          name,
          isActive: path === activePath,
        });
      }
    });

    // Truncate to maxNotes
    const limitedTabs = tabs.slice(0, Math.max(0, maxNotes));

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
      tabs: limitedTabs,
      selection,
    };
  }
}
