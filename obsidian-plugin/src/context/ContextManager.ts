import { App, EventRef, MarkdownView } from "obsidian";
import { existsSync, mkdirSync, writeFile } from "fs";
import { join } from "path";
import { OpenCodeSettings } from "../types";
import { WorkspaceContext } from "./WorkspaceContext";

type ContextManagerDeps = {
  app: App;
  settings: OpenCodeSettings;
  getProjectDirectory: () => string;
  registerEvent: (ref: EventRef) => void;
};

export class ContextManager {
  private app: App;
  private settings: OpenCodeSettings;
  private workspaceContext: WorkspaceContext;
  private getProjectDirectory: () => string;
  private registerEvent: (ref: EventRef) => void;

  private contextEventRefs: EventRef[] = [];
  private contextRefreshTimer: number | null = null;
  private dirCreated = false;

  constructor(deps: ContextManagerDeps) {
    this.app = deps.app;
    this.settings = deps.settings;
    this.workspaceContext = new WorkspaceContext(this.app);
    this.getProjectDirectory = deps.getProjectDirectory;
    this.registerEvent = deps.registerEvent;
  }

  updateSettings(settings: OpenCodeSettings): void {
    this.settings = settings;
    this.updateListeners();
  }

  /** Start listening (call after settings are loaded). */
  start(): void {
    this.updateListeners();
  }

  private updateListeners(): void {
    if (!this.settings.injectWorkspaceContext) {
      this.clearListeners();
      return;
    }

    // Already listening
    if (this.contextEventRefs.length > 0) {
      return;
    }

    const activeLeafRef = this.app.workspace.on("active-leaf-change", (leaf) => {
      if (leaf?.view instanceof MarkdownView) {
        this.workspaceContext.trackActiveView(leaf.view);
      }
      this.scheduleRefresh();
    });

    const fileOpenRef = this.app.workspace.on("file-open", () => {
      this.scheduleRefresh();
    });

    const fileCloseRef = (this.app.workspace as any).on("file-close", () => {
      this.scheduleRefresh();
    });

    const layoutChangeRef = this.app.workspace.on("layout-change", () => {
      this.scheduleRefresh();
    });

    const selectionChangeRef = (this.app.workspace as any).on(
      "editor-selection-change",
      (_editor: unknown, view: unknown) => {
        if (view instanceof MarkdownView) {
          this.workspaceContext.trackActiveView(view);
        }
        this.scheduleRefresh(200);
      }
    );

    this.contextEventRefs = [
      activeLeafRef,
      fileOpenRef,
      fileCloseRef,
      layoutChangeRef,
      selectionChangeRef,
    ];
    this.contextEventRefs.forEach((ref) => this.registerEvent(ref));
  }

  private clearListeners(): void {
    for (const ref of this.contextEventRefs) {
      this.app.workspace.offref(ref);
    }
    this.contextEventRefs = [];
    if (this.contextRefreshTimer !== null) {
      window.clearTimeout(this.contextRefreshTimer);
      this.contextRefreshTimer = null;
    }
  }

  private scheduleRefresh(delayMs: number = 300): void {
    if (this.contextRefreshTimer !== null) {
      window.clearTimeout(this.contextRefreshTimer);
    }

    this.contextRefreshTimer = window.setTimeout(() => {
      this.contextRefreshTimer = null;
      this.writeState();
    }, delayMs);
  }

  /** Gather workspace state and write it to .opencode/obsidian-state.json */
  private writeState(): void {
    if (!this.settings.injectWorkspaceContext) {
      return;
    }

    const projectDir = this.getProjectDirectory();
    if (!projectDir) {
      return;
    }

    const state = this.workspaceContext.gatherState(
      this.settings.maxNotesInContext,
      this.settings.maxSelectionLength
    );

    try {
      const dir = join(projectDir, ".opencode");
      if (!this.dirCreated) {
        if (!existsSync(dir)) {
          mkdirSync(dir, { recursive: true });
        }
        this.dirCreated = true;
      }
      const filePath = join(dir, "obsidian-state.json");
      writeFile(filePath, JSON.stringify(state, null, 2), "utf-8", (err) => {
        if (err) {
          console.error("[OpenCode] Failed to write obsidian-state.json:", err);
        }
      });
    } catch (err) {
      console.error("[OpenCode] Failed to write obsidian-state.json:", err);
    }
  }

  destroy(): void {
    this.clearListeners();
  }
}
