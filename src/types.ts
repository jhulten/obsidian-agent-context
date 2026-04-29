export interface PluginSettings {
  injectWorkspaceContext: boolean;
  maxNotesInContext: number;
  maxSelectionLength: number;
}

export const DEFAULT_SETTINGS: PluginSettings = {
  injectWorkspaceContext: true,
  maxNotesInContext: 20,
  maxSelectionLength: 2000,
};

// Shape of the JSON written to .obsidian/context.json
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
