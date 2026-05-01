import { App, Plugin, PluginSettingTab, Setting } from "obsidian";
import { PluginSettings } from "../types";

export class ContextSettingTab extends PluginSettingTab {
  constructor(
    app: App,
    plugin: Plugin,
    private settings: PluginSettings,
    private onSettingsChange: () => Promise<void>
  ) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    new Setting(containerEl).setName("Agent context settings").setHeading();

    new Setting(containerEl)
      .setName("Inject workspace context")
      .setDesc(
        "Write open note paths and selections to the config folder's context.json for external tools to read"
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.settings.injectWorkspaceContext)
          .onChange(async (value) => {
            this.settings.injectWorkspaceContext = value;
            await this.onSettingsChange();
          })
      );

    new Setting(containerEl)
      .setName("Max notes in context")
      .setDesc("Limit how many open notes are included")
      .addSlider((slider) =>
        slider
          .setLimits(1, 50, 1)
          .setValue(this.settings.maxNotesInContext)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.settings.maxNotesInContext = value;
            await this.onSettingsChange();
          })
      );

    new Setting(containerEl)
      .setName("Max selection length")
      .setDesc("Truncate selected text to avoid oversized context")
      .addSlider((slider) =>
        slider
          .setLimits(500, 5000, 100)
          .setValue(this.settings.maxSelectionLength)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.settings.maxSelectionLength = value;
            await this.onSettingsChange();
          })
      );

    new Setting(containerEl)
      .setName("Refresh interval")
      .setDesc("How often to sync open tabs (seconds)")
      .addSlider((slider) =>
        slider
          .setLimits(1, 30, 1)
          .setValue(this.settings.refreshIntervalMs / 1000)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.settings.refreshIntervalMs = value * 1000;
            await this.onSettingsChange();
          })
      );
  }
}
