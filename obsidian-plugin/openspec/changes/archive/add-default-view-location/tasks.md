## 1. Implementation

- [ ] 1.1 Add `defaultViewLocation` type and setting to `src/types.ts`
  - Add type: `"sidebar" | "main"`
  - Add to `OpenCodeSettings` interface
  - Add default value `"sidebar"` to `DEFAULT_SETTINGS`

- [ ] 1.2 Update `src/main.ts` view activation logic
  - Modify `activateView()` method to check `defaultViewLocation` setting
  - For "sidebar": use `getLeaf("right")` (existing behavior)
  - For "main": use `getLeaf("tab")` to open in main editor area
  - Ensure existing view detection works for both locations

- [ ] 1.3 Add setting UI to `src/SettingsTab.ts`
  - Add dropdown setting for "Default view location"
  - Options: "Sidebar" and "Main window"
  - Description explaining the behavior difference

- [ ] 1.4 Test the feature
  - Verify sidebar mode opens in right sidebar
  - Verify main mode opens as a tab in editor area
  - Verify toggling reveals existing view regardless of location
  - Verify setting persists across plugin reload
