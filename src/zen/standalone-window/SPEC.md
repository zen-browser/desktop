# External Link Standalone Window

## Intent

External links opened from other apps can be handled as temporary standalone windows instead of being routed directly into a Zen workspace. This keeps quick lookups, documentation links, and one-off searches out of the user's organized workspace until the user explicitly keeps them.

## Product Decisions

- Each external link opens its own standalone window.
- Standalone windows are popup-like browser windows, not workspace tabs.
- Standalone windows should open on the current desktop/screen, including over a fullscreen app when the platform supports it.
- Standalone windows do not have a sidebar and are not assigned to a workspace.
- Multiple standalone windows can coexist.
- A standalone window has two lifecycle actions:
  - Close: close the standalone window without keeping it.
  - Keep/Open in Space: convert the standalone window URL into a normal Zen tab in a chosen space.
- The default keep target is the most recent/default space, with a future picker for selecting another space.

## Implementation Blocks

- External-link initiation: detect eligible `fromExternal` tab opens and branch before normal space routing.
- Standalone window construction: create one popup-like browser window for the external URL.
- Standalone UI initialization: mark the new window as standalone and attach the keep/close controls.
- Lifecycle registration: observe standalone window close/unload and clear transient standalone state.
- Keep action: open the standalone window URL into a normal workspace tab, then close the standalone window.
- Workspace choice: default to most recent space; later expose a space picker in the standalone toolbar.

## Current Status

The routing hook and method boundaries exist. The constructor still returns `null`, so the feature falls back to the current tab-opening behavior until each block is implemented.
