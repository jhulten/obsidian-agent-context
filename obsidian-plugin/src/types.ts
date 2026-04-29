export interface OpenCodeSettings {
  projectDirectory: string;
  injectWorkspaceContext: boolean;
  maxNotesInContext: number;
  maxSelectionLength: number;
}

export const DEFAULT_SETTINGS: OpenCodeSettings = {
  projectDirectory: "",
  injectWorkspaceContext: true,
  maxNotesInContext: 20,
  maxSelectionLength: 2000,
};

// JSON shape written to .opencode/obsidian-state.json
// Must match the TUI plugin's ObsidianState type
export type TabInfo = {
  path: string;
  name: string;
  isActive: boolean;
};

export type SelectionInfo = {
  text: string;
  sourcePath: string;
};

export type ObsidianState = {
  ts: number;
  active: { path: string; name: string } | null;
  tabs: TabInfo[];
  selection: SelectionInfo | null;
};
