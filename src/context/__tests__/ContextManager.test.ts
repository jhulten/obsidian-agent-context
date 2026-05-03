import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ContextManager } from "../ContextManager";
import type { PluginSettings } from "../../types";
import { DEFAULT_SETTINGS } from "../../types";

// ---------------------------------------------------------------------------
// Module mocks
// vi.hoisted() variables are available inside vi.mock() factory functions.
// ---------------------------------------------------------------------------

const { mockWriteFile, mockGatherState } = vi.hoisted(() => ({
  mockWriteFile: vi.fn(),
  mockGatherState: vi.fn().mockReturnValue({
    ts: 1_000,
    active: null,
    tabs: [],
    selection: null,
  }),
}));

// Stub the heavy Obsidian module – only MarkdownView is used as a runtime value;
// App, EventRef, and Workspace are TypeScript-only type imports in ContextManager.
vi.mock("obsidian", () => ({
  MarkdownView: class MarkdownView {},
  App: class App {},
  Workspace: class Workspace {},
}));

// Capture writeFile calls without touching the real filesystem.
vi.mock("fs", () => ({
  writeFile: (...args: unknown[]) => mockWriteFile(...args),
}));

// Stub WorkspaceContext so ContextManager tests stay focused.
// Must use a regular function (not an arrow function) so `new WorkspaceContext()`
// works correctly.
vi.mock("../WorkspaceContext", () => ({
  WorkspaceContext: vi.fn(function () {
    return {
      trackActiveView: vi.fn(),
      gatherState: mockGatherState,
    };
  }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeManager(overrides: Partial<PluginSettings> = {}, cleanup: boolean = true) {
  const settings: PluginSettings = { ...DEFAULT_SETTINGS, ...overrides };

  const workspaceOn = vi.fn().mockReturnValue({});
  const workspaceOffref = vi.fn();
  const app = {
    workspace: { on: workspaceOn, offref: workspaceOffref },
  } as never;

  const registerEvent = vi.fn();

  const manager = new ContextManager({
    app,
    settings,
    getVaultBasePath: () => "/vault",
    getConfigDir: () => ".obsidian",
    registerEvent,
  });

  if (cleanup) {
    managersToCleanup.push(manager);
  }

  return { manager, registerEvent, workspaceOn, workspaceOffref };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

// Track all managers created per test so pending intervals are always cleaned
// up in afterEach, preventing timer leaks between tests.
let managersToCleanup: ContextManager[] = [];

describe("ContextManager", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockWriteFile.mockClear();
    mockGatherState.mockClear();
    managersToCleanup = [];
  });

  afterEach(() => {
    for (const m of managersToCleanup) {
      m.destroy();
    }
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // Guard: writeState() must skip when the feature is disabled
  // -------------------------------------------------------------------------

  describe("writeState guard when disabled", () => {
    it("does not write context.json when injectWorkspaceContext is false", () => {
      const { manager } = makeManager({ injectWorkspaceContext: false });

      manager.start();
      // vi.runAllTimers() fires the 2-second warmup setTimeout, but writeState()
      // exits early via the injectWorkspaceContext guard – no write occurs.
      vi.runAllTimers();

      expect(mockWriteFile).not.toHaveBeenCalled();
    });

    it("writes context.json when injectWorkspaceContext is true", () => {
      const { manager } = makeManager({ injectWorkspaceContext: true });

      manager.start();
      // writeState is called synchronously inside start()
      expect(mockWriteFile).toHaveBeenCalled();
    });

    it("stops writing after the feature is disabled via updateSettings", () => {
      const { manager } = makeManager({ injectWorkspaceContext: true });

      manager.start();
      mockWriteFile.mockClear();

      manager.updateSettings({ ...DEFAULT_SETTINGS, injectWorkspaceContext: false });

      // Any timer-based writes that fire from this point on must be skipped.
      vi.runAllTimers();

      expect(mockWriteFile).not.toHaveBeenCalled();
    });

    it("resumes writing after the feature is re-enabled via updateSettings", () => {
      const { manager } = makeManager({ injectWorkspaceContext: false });

      manager.start();
      mockWriteFile.mockClear();

      manager.updateSettings({ ...DEFAULT_SETTINGS, injectWorkspaceContext: true });

      // Advance past the warmup timeout and one periodic tick.
      vi.advanceTimersByTime(DEFAULT_SETTINGS.refreshIntervalMs);

      expect(mockWriteFile).toHaveBeenCalled();
    });

    it("remains functional across multiple enable/disable/re-enable transitions", () => {
      const { manager } = makeManager({ injectWorkspaceContext: true });

      // Start enabled.
      manager.start();
      expect(mockWriteFile).toHaveBeenCalled();

      // Disable – no further writes on tick.
      manager.updateSettings({ ...DEFAULT_SETTINGS, injectWorkspaceContext: false });
      mockWriteFile.mockClear();
      vi.advanceTimersByTime(DEFAULT_SETTINGS.refreshIntervalMs);
      expect(mockWriteFile).not.toHaveBeenCalled();

      // Re-enable – writes resume on the next periodic tick.
      manager.updateSettings({ ...DEFAULT_SETTINGS, injectWorkspaceContext: true });
      vi.advanceTimersByTime(DEFAULT_SETTINGS.refreshIntervalMs);
      expect(mockWriteFile).toHaveBeenCalled();
    });

    // TODO: add tests verifying that workspace event listeners
    // (active-leaf-change, file-open, file-close, layout-change,
    // editor-selection-change) are registered when injectWorkspaceContext
    // transitions false→true and deregistered when it transitions true→false
    // via updateSettings(). This requires stubbing app.workspace.on/offref
    // at a finer grain and is tracked as a follow-up to this PR.
  });

  // -------------------------------------------------------------------------
  // Periodic refresh lifecycle
  // -------------------------------------------------------------------------

  describe("periodic refresh", () => {
    it("starts a periodic interval when enabled", () => {
      const setIntervalSpy = vi.spyOn(global, "setInterval");
      const { manager } = makeManager({ injectWorkspaceContext: true, refreshIntervalMs: 3000 });

      manager.start();

      const calls = setIntervalSpy.mock.calls.filter(
        ([, delay]) => delay === 3000
      );
      expect(calls.length).toBeGreaterThan(0);
    });

    it("does not start a periodic interval when disabled", () => {
      const setIntervalSpy = vi.spyOn(global, "setInterval");
      const { manager } = makeManager({ injectWorkspaceContext: false, refreshIntervalMs: 3000 });

      manager.start();

      const calls = setIntervalSpy.mock.calls.filter(
        ([, delay]) => delay === 3000
      );
      expect(calls.length).toBe(0);
    });

    it("calls writeState on each periodic tick when enabled", () => {
      const { manager } = makeManager({ injectWorkspaceContext: true, refreshIntervalMs: 3000 });

      manager.start();
      const countAfterStart = mockWriteFile.mock.calls.length;

      vi.advanceTimersByTime(3000);
      expect(mockWriteFile.mock.calls.length).toBeGreaterThan(countAfterStart);
    });

    it("stops the periodic interval on destroy()", () => {
      const clearIntervalSpy = vi.spyOn(global, "clearInterval");
      const { manager } = makeManager({ injectWorkspaceContext: true });

      manager.start();
      manager.destroy();

      expect(clearIntervalSpy).toHaveBeenCalled();
    });

    it("does not call writeState after destroy()", () => {
      const { manager } = makeManager({ injectWorkspaceContext: true, refreshIntervalMs: 3000 });

      manager.start();
      // Let the one-shot 2-second warmup timer in start() fire before we
      // destroy, so it cannot be a source of false positives.
      vi.advanceTimersByTime(2100);
      manager.destroy();
      mockWriteFile.mockClear();

      // Advance well past one full periodic interval – no writes should occur.
      vi.advanceTimersByTime(9000);

      expect(mockWriteFile).not.toHaveBeenCalled();
    });

    it("stops the periodic interval when feature is disabled via updateSettings", () => {
      const clearIntervalSpy = vi.spyOn(global, "clearInterval");
      const { manager } = makeManager({ injectWorkspaceContext: true });

      manager.start();
      clearIntervalSpy.mockClear();

      manager.updateSettings({ ...DEFAULT_SETTINGS, injectWorkspaceContext: false });

      expect(clearIntervalSpy).toHaveBeenCalled();
    });

    it("starts periodic interval when feature is enabled via updateSettings", () => {
      const setIntervalSpy = vi.spyOn(global, "setInterval");
      const { manager } = makeManager({ injectWorkspaceContext: false, refreshIntervalMs: 3000 });

      manager.start();
      setIntervalSpy.mockClear();

      manager.updateSettings({ ...DEFAULT_SETTINGS, injectWorkspaceContext: true, refreshIntervalMs: 3000 });

      const calls = setIntervalSpy.mock.calls.filter(([, delay]) => delay === 3000);
      expect(calls.length).toBeGreaterThan(0);
    });
  });

  // -------------------------------------------------------------------------
  // updateSettings – interval change
  // -------------------------------------------------------------------------

  describe("updateSettings – interval change", () => {
    it("restarts periodic refresh with the new interval", () => {
      const setIntervalSpy = vi.spyOn(global, "setInterval");
      const clearIntervalSpy = vi.spyOn(global, "clearInterval");
      const { manager } = makeManager({ injectWorkspaceContext: true, refreshIntervalMs: 3000 });

      manager.start();
      setIntervalSpy.mockClear();
      clearIntervalSpy.mockClear();

      manager.updateSettings({ ...DEFAULT_SETTINGS, refreshIntervalMs: 5000 });

      // Old timer cancelled, new one started with updated delay.
      expect(clearIntervalSpy).toHaveBeenCalled();
      const newCalls = setIntervalSpy.mock.calls.filter(([, delay]) => delay === 5000);
      expect(newCalls.length).toBeGreaterThan(0);
    });

    it("does not restart periodic refresh when the interval is unchanged", () => {
      const setIntervalSpy = vi.spyOn(global, "setInterval");
      const { manager } = makeManager({ injectWorkspaceContext: true, refreshIntervalMs: 3000 });

      manager.start();
      setIntervalSpy.mockClear();

      // Same interval value – no restart expected.
      manager.updateSettings({ ...DEFAULT_SETTINGS, refreshIntervalMs: 3000 });

      expect(setIntervalSpy).not.toHaveBeenCalled();
    });

    it("does not start a periodic interval when feature is disabled and interval changes", () => {
      const setIntervalSpy = vi.spyOn(global, "setInterval");
      const { manager } = makeManager({ injectWorkspaceContext: false, refreshIntervalMs: 3000 });

      manager.start();
      setIntervalSpy.mockClear();

      // Feature is still disabled – changing the interval must not start a timer.
      manager.updateSettings({ ...DEFAULT_SETTINGS, injectWorkspaceContext: false, refreshIntervalMs: 5000 });

      expect(setIntervalSpy).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Path safety in writeState
  // -------------------------------------------------------------------------

  describe("writeState path safety", () => {
    it("writes context.json to the correct path when configDir is inside the vault", () => {
      const { manager } = makeManager({ injectWorkspaceContext: true });

      manager.start();

      // The path must be exactly <vault>/<configDir>/context.json.
      expect(mockWriteFile).toHaveBeenCalledWith(
        "/vault/.obsidian/context.json",
        expect.any(String),
        "utf-8",
        expect.any(Function)
      );
    });

    it("refuses to write when a relative configDir traverses outside the vault", () => {
      // Simulate a relative configDir that escapes the vault root via "..".
      const maliciousManager = new ContextManager({
        app: {
          workspace: { on: vi.fn().mockReturnValue({}), offref: vi.fn() },
        } as never,
        settings: { ...DEFAULT_SETTINGS },
        getVaultBasePath: () => "/vault",
        getConfigDir: () => "../../etc",
        registerEvent: vi.fn(),
      });
      managersToCleanup.push(maliciousManager);

      maliciousManager.start();

      // Escaping the vault must prevent any write attempt entirely.
      expect(mockWriteFile).not.toHaveBeenCalled();
    });

    it("refuses to write when configDir is an absolute path outside the vault", () => {
      // path.resolve() treats an absolute configDir as overriding basePath entirely,
      // so "/etc" resolves to "/etc/context.json" which is outside "/vault/".
      const maliciousManager = new ContextManager({
        app: {
          workspace: { on: vi.fn().mockReturnValue({}), offref: vi.fn() },
        } as never,
        settings: { ...DEFAULT_SETTINGS },
        getVaultBasePath: () => "/vault",
        getConfigDir: () => "/etc",
        registerEvent: vi.fn(),
      });
      managersToCleanup.push(maliciousManager);

      maliciousManager.start();

      expect(mockWriteFile).not.toHaveBeenCalled();
    });

    it("refuses to write when getVaultBasePath returns an empty string", () => {
      // writeState() has an early-return guard for falsy basePath values.
      const noBaseManager = new ContextManager({
        app: {
          workspace: { on: vi.fn().mockReturnValue({}), offref: vi.fn() },
        } as never,
        settings: { ...DEFAULT_SETTINGS },
        getVaultBasePath: () => "",
        getConfigDir: () => ".obsidian",
        registerEvent: vi.fn(),
      });
      managersToCleanup.push(noBaseManager);

      noBaseManager.start();

      expect(mockWriteFile).not.toHaveBeenCalled();
    });
  });
});
