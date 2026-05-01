import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ContextManager } from "../ContextManager";
import type { PluginSettings } from "../../types";

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

// Stub the heavy Obsidian module – only MarkdownView is referenced at runtime.
vi.mock("obsidian", () => ({
  MarkdownView: class MarkdownView {},
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

const DEFAULT_SETTINGS: PluginSettings = {
  injectWorkspaceContext: true,
  maxNotesInContext: 20,
  maxSelectionLength: 2000,
  refreshIntervalMs: 3000,
};

function makeManager(overrides: Partial<PluginSettings> = {}) {
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

  return { manager, registerEvent, workspaceOn, workspaceOffref };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ContextManager", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockWriteFile.mockClear();
    mockGatherState.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // -------------------------------------------------------------------------
  // Guard: writeState() must skip when the feature is disabled
  // -------------------------------------------------------------------------

  describe("writeState guard when disabled", () => {
    it("does not write context.json when injectWorkspaceContext is false", () => {
      const { manager } = makeManager({ injectWorkspaceContext: false });

      manager.start();
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

      vi.runAllTimers();

      expect(mockWriteFile).toHaveBeenCalled();
    });
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
  });

  // -------------------------------------------------------------------------
  // Path safety in writeState
  // -------------------------------------------------------------------------

  describe("writeState path safety", () => {
    it("refuses to write outside the vault directory", () => {
      const { manager } = makeManager({ injectWorkspaceContext: true });

      // Simulate a malicious configDir that escapes the vault root.
      const maliciousManager = new ContextManager({
        app: {
          workspace: { on: vi.fn().mockReturnValue({}), offref: vi.fn() },
        } as never,
        settings: { ...DEFAULT_SETTINGS },
        getVaultBasePath: () => "/vault",
        getConfigDir: () => "../../etc",
        registerEvent: vi.fn(),
      });

      maliciousManager.start();

      // Escaping the vault must prevent any write attempt entirely.
      expect(mockWriteFile).not.toHaveBeenCalled();

      maliciousManager.destroy();
    });
  });
});
