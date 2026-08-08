# External Link Standalone Window Implementation Plan

## Goal

Implement Arc-like external link standalone windows for Zen.

When the Tab Management setting "Open External Links directly into the most recent space." is checked, Zen keeps the current behavior. When unchecked, external links opened from other apps should open in standalone windows. These windows are popup-like, have no sidebar/workspace, and can either be closed or kept by opening the URL into a normal Zen space.

## File Purposes

### `src/zen/space-routing/ZenSpaceRoutingManager.sys.mjs`

Purpose: Owns Zen's existing route decision before a tab is added. This remains the gate that detects `fromExternal` URLs and decides whether to branch into standalone-window handling instead of normal workspace routing.

Methods to complete or verify:

- `shouldOpenExternalLinkInStandaloneWindow(uriString, options, win)`
  - Purpose: Decide whether the external-link standalone-window path should run.
  - Current state: Implemented as a guard using `options.fromExternal`, workspace availability, `zen.standalone-window.enabled`, and the inverted user setting.
  - Remaining work: Verify edge cases once the standalone constructor works, especially startup/session restore, private windows, pinned tabs, container tabs, and invalid URLs.

- `openExternalLinkInStandaloneWindow(uriString, options, win)`
  - Purpose: Delegate eligible external links to `ZenStandaloneWindowManager`.
  - Current state: Calls `gZenStandaloneWindowManager.openExternalLinkStandaloneWindow(...)`.
  - Remaining work: No major logic expected here unless the routing contract changes.

- `constructExternalLinkStandaloneWindow(uriString, options, win)`
  - Purpose: Compatibility wrapper for the standalone-window constructor.
  - Current state: Delegates to `openExternalLinkInStandaloneWindow(...)`.
  - Remaining work: Remove later if no callers need this name.

## `src/zen/standalone-window/ZenStandaloneWindowManager.sys.mjs`

Purpose: Owns the standalone-window feature itself: request creation, standalone window construction, UI setup, lifecycle, and keeping the standalone URL into a workspace.

Methods to complete:

- `openExternalLinkStandaloneWindow({ uriString, options, openerWindow })`
  - Purpose: Main feature entry point.
  - Current state: Normalizes the request, constructs a standalone window, initializes it, and registers lifecycle handlers.
  - Remaining work: Revisit error handling after `constructStandaloneWindow(...)` creates real windows.

- `createExternalLinkStandaloneWindowRequest({ uriString, options, openerWindow })`
  - Purpose: Convert the raw external-link call into a stable request object for all later methods.
  - Current state: Stores URL, copied options, opener window, source, and default target route.
  - Remaining work: Add fields if needed, such as opener screen/desktop info, principal/security data, private browsing state, user context, or source app metadata if available.

- `constructStandaloneWindow(request)`
  - Purpose: Actually create the popup-like browser window.
  - Current state: Builds initial URL/features, then returns `null` so current behavior falls back.
  - Remaining work: Implement the real window creation. Likely use Firefox/Zen browser-window opening APIs with popup-style features, load `request.uriString`, and return the created window.

- `getStandaloneWindowInitialURL(request)`
  - Purpose: Decide what URL the standalone window loads first.
  - Current state: Returns `request.uriString`.
  - Remaining work: Confirm whether the standalone window should load the URL directly or load a wrapper chrome page that embeds the URL.

- `getStandaloneWindowFeatures(request)`
  - Purpose: Build native window features for the popup-like standalone window.
  - Current state: Returns `chrome,popup,resizable,centerscreen,width=...,height=...`.
  - Remaining work: Tune features for macOS fullscreen behavior, titlebar style, toolbar visibility, and whether browser chrome should be reduced or custom.

- `initializeStandaloneWindow(standaloneWindow, request)`
  - Purpose: Apply all standalone-specific setup after the window exists.
  - Current state: Calls `markWindowAsStandalone(...)` and `initializeStandaloneToolbar(...)`.
  - Remaining work: Add calls for sidebar hiding, workspace detachment, window styling, and any standalone-only browser attributes.

- `markWindowAsStandalone(standaloneWindow, request)`
  - Purpose: Attach state that identifies the window as an external-link standalone window.
  - Current state: Sets `standaloneWindow.ZenExternalLinkStandalone`.
  - Remaining work: Decide whether to also use DOM attributes, browser attributes, or window type markers for CSS/sessionstore/test visibility.

- `initializeStandaloneToolbar(standaloneWindow, request)`
  - Purpose: Add or activate the Arc-style top-right controls.
  - Current state: Gets action descriptors but does not render UI.
  - Remaining work: Add the visible "Open in [Space]" button, shortcut hint, dropdown button, and event handlers.

- `getStandaloneToolbarActions(standaloneWindow, request)`
  - Purpose: Define the toolbar actions independently from rendering.
  - Current state: Returns descriptors for default open-in-space and space picker.
  - Remaining work: Fill labels from localization, include current/default space name, include command callbacks, and include disabled states if needed.

- `registerStandaloneWindowLifecycle(standaloneWindow, request)`
  - Purpose: Attach lifecycle observers for standalone window close/unload.
  - Current state: Registers a one-time unload handler.
  - Remaining work: Add cleanup for toolbar listeners, references, observers, and any temporary browser/window state.

- `closeStandaloneWindow(standaloneWindow)`
  - Purpose: Close the standalone window without keeping it.
  - Current state: Calls `standaloneWindow.close()`.
  - Remaining work: Confirm close behavior matches normal window close, including prompts, beforeunload handling, and private browsing.

- `onStandaloneWindowClosed(standaloneWindow)`
  - Purpose: Clear transient state when the standalone window closes.
  - Current state: Clears `ZenExternalLinkStandalone`.
  - Remaining work: Remove any future stored manager references, event listeners, or window registry entries.

- `keepStandaloneWindowInSpace(standaloneWindow, targetRoute)`
  - Purpose: Convert a standalone window into a normal Zen tab in a workspace.
  - Current state: Reads standalone state, resolves target route, calls `openStandaloneUrlInSpace(...)`, then closes the standalone window if successful.
  - Remaining work: Decide whether to preserve only the URL or also navigation history, scroll state, title, favicon, container identity, and permissions state.

- `onOpenInDefaultSpaceCommand(standaloneWindow)`
  - Purpose: Handler for the primary "Open in [Space]" button.
  - Current state: Calls `keepStandaloneWindowInSpace(...)`.
  - Remaining work: Wire to the actual toolbar button.

- `onOpenInSelectedSpaceCommand(standaloneWindow, targetRoute)`
  - Purpose: Handler for choosing a specific workspace from the dropdown.
  - Current state: Calls `keepStandaloneWindowInSpace(...)` with the selected route.
  - Remaining work: Wire to the space picker menu.

- `openStandaloneSpacePicker(standaloneWindow)`
  - Purpose: Open the workspace picker/dropdown for the standalone toolbar.
  - Current state: Placeholder returning `false`.
  - Remaining work: Build or reuse an existing workspace picker UI, list spaces, support search if needed, and call `onOpenInSelectedSpaceCommand(...)`.

- `resolveKeepTargetRoute(standaloneWindow, targetRoute)`
  - Purpose: Decide the workspace route used when keeping the standalone window.
  - Current state: Uses explicit route, then standalone state route, then `"most-recent-space"`.
  - Remaining work: Confirm how `"most-recent-space"` should map to the actual active/recent workspace at keep time.

- `openStandaloneUrlInSpace(uriString, targetRoute, standaloneWindow)`
  - Purpose: Open the standalone window URL as a normal Zen tab in the requested workspace.
  - Current state: Placeholder returning `false`.
  - Remaining work: Implement normal tab creation, pass route/context information, avoid reopening as another standalone window, move/select target workspace when appropriate, and close standalone window only after success.

- `getDefaultKeepTargetRoute(openerWindow)`
  - Purpose: Decide the default target for the primary keep button.
  - Current state: Returns `"most-recent-space"`.
  - Remaining work: Use the same logic as existing external default routing if desired, and expose the default space name for the toolbar label.

## `src/zen/standalone-window/SPEC.md`

Purpose: Captures the product behavior and implementation boundaries for the feature.

Remaining work:

- Keep it updated as decisions change.
- Add screenshots or UI notes if the toolbar behavior diverges from the Arc reference.

## `src/zen/standalone-window/moz.build`

Purpose: Packages `ZenStandaloneWindowManager.sys.mjs` as `resource:///modules/zen/standalonewindow/ZenStandaloneWindowManager.sys.mjs`.

Remaining work:

- Add more JS modules here if the standalone-window feature is split into UI/controller/helper files.

## `src/zen/moz.build`

Purpose: Includes the `standalone-window` folder in the Zen build.

Remaining work:

- No expected feature logic here.

## `src/browser/components/preferences/zenTabsManagement.inc.xhtml`

Purpose: Places the user-facing checkbox in Tab Management > Workspaces.

Current behavior:

- Checked: "Open External Links directly into the most recent space."
- Unchecked: external links use the future standalone-window path.

Remaining work:

- Confirm exact copy/capitalization.
- Add a description only if the setting becomes unclear.

## `src/browser/components/preferences/zen-settings.js`

Purpose: Registers the standalone-window prefs in the Preferences UI system.

Prefs:

- `zen.standalone-window.enabled`
- `zen.standalone-window.open-external-links-in-most-recent-space`
- `zen.standalone-window.reuse-existing`
- `zen.standalone-window.default-width`
- `zen.standalone-window.default-height`

Remaining work:

- Remove `zen.standalone-window.reuse-existing` if the product decision remains "always create a new standalone window".
- Keep width/height prefs if they are used by the constructor.

## `prefs/zen/standalone-window.yaml`

Purpose: Defines default standalone-window prefs for generated browser pref files.

Remaining work:

- Same as `zen-settings.js`: remove unused prefs once implementation stabilizes.

## `locales/en-US/browser/browser/preferences/zen-preferences.ftl`

Purpose: Provides the user-facing label for the setting.

Remaining work:

- Add more localization IDs when toolbar UI is implemented, likely:
  - `zen-standalone-window-open-in-space`
  - `zen-standalone-window-open-in-named-space`
  - `zen-standalone-window-choose-space`
  - `zen-standalone-window-close`

## Suggested Build Order

1. Implement `constructStandaloneWindow(...)`.
2. Make standalone windows visually/window-state distinct in `initializeStandaloneWindow(...)`.
3. Implement `closeStandaloneWindow(...)` edge cases.
4. Implement `openStandaloneUrlInSpace(...)`.
5. Wire the primary toolbar button through `initializeStandaloneToolbar(...)`.
6. Implement the workspace picker with `openStandaloneSpacePicker(...)`.
7. Add tests/manual test cases for external app links, multiple standalone windows, close, keep to default space, and keep to selected space.

## Manual Test Scenarios

- External link with setting checked opens normally in the most recent space.
- External link with setting unchecked opens a standalone window.
- Opening two external links creates two separate standalone windows.
- Closing a standalone window does not create or keep a workspace tab.
- Keeping a standalone window opens the URL in a normal workspace tab and closes the standalone window.
- Keeping to a selected workspace opens the URL in that workspace.
- Standalone windows do not show the normal Zen sidebar.
- Standalone windows open on the current desktop/screen, including while another app is fullscreen.
