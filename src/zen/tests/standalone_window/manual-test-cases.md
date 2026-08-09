# External Link Standalone Window Manual Test Cases

## Setup

1. Enable `zen.standalone-window.enabled`.
2. Disable `zen.standalone-window.open-external-links-in-most-recent-space`.
3. Keep one normal Zen window open with workspaces enabled.

## Cases

1. External app link
   - Open a link from another app, such as Mail, Slack, or Terminal `open`.
   - Expected: Zen opens a standalone window, not a normal workspace tab.
   - Expected: the standalone window has no sidebar/workspace tab strip.

2. Multiple standalone windows
   - Open two different links from another app.
   - Expected: two separate standalone windows are created.

3. Close without keeping
   - Open a standalone window and close it.
   - Expected: no new tab is added to any normal Zen workspace.

4. Keep in default space
   - Open a standalone window.
   - Click `Open in Space`.
   - Expected: the URL opens as a selected normal tab in the default target space.
   - Expected: the standalone window closes.

5. Keep in selected space
   - Create at least two workspaces.
   - Open a standalone window.
   - Click `Choose Space` and select a non-current workspace.
   - Expected: the URL opens as a normal tab assigned to the selected workspace.
   - Expected: the standalone window closes.
