import { Plugin } from "obsidian";
import { OpenCodeSettings, DEFAULT_SETTINGS } from "./types";
import { OpenCodeSettingTab } from "./settings/SettingsTab";
import { ContextManager } from "./context/ContextManager";

export default class OpenCodePlugin extends Plugin {
  settings: OpenCodeSettings = DEFAULT_SETTINGS;
  private contextManager!: ContextManager;

  async onload(): Promise<void> {
    console.log("Loading OpenCode plugin");

    await this.loadSettings();

    this.contextManager = new ContextManager({
      app: this.app,
      settings: this.settings,
      getVaultBasePath: () => this.getVaultBasePath(),
      registerEvent: (ref) => this.registerEvent(ref),
    });

    this.addSettingTab(
      new OpenCodeSettingTab(
        this.app,
        this,
        this.settings,
        () => this.saveSettings()
      )
    );

    // Start listening to workspace events once layout is ready
    this.app.workspace.onLayoutReady(() => {
      this.contextManager.start();
    });

    console.log("OpenCode plugin loaded");
  }

  async onunload(): Promise<void> {
    this.contextManager.destroy();
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
    this.contextManager.updateSettings(this.settings);
  }

  private getVaultBasePath(): string {
    const adapter = this.app.vault.adapter as any;
    return adapter.basePath || "";
  }
}
