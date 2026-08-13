# External Link Standalone Window Manual Test Cases

## Setup

1. Enable `zen.standalone-window.enabled`.
2. Keep one normal Zen window open with workspaces enabled.

## Cases

1. External app link
   - Open a link from another app, such as Mail, Slack, or Terminal `open`.
   - Expected: Zen opens a standalone window, not a normal workspace tab.
   - Expected: the standalone window has no sidebar, tab strip or bookmarks toolbar, and no sidebar flashes on the way in.
   - Expected: the URL bar is present and editable.

2. Multiple standalone windows
   - Open two different links from another app.
   - Expected: two separate standalone windows, offset from each other rather than stacked.

3. Close without keeping
   - Open a standalone window and press `Close` in the toolbar.
   - Expected: no new tab is added to any normal Zen workspace.

4. Keep in default space
   - Open a standalone window, follow a couple of links inside it, then click `Open in Space`.
   - Expected: the page opens as a selected normal tab in the space that was active when the link arrived.
   - Expected: the page is not reloaded, and Back still walks the history built inside the standalone window.
   - Expected: the standalone window closes.

5. Keep in selected space
   - Create at least two workspaces.
   - Open a standalone window, click `Choose Space` and select a non-current workspace.
   - Expected: the page becomes a tab assigned to the selected workspace, and Zen switches to it.
   - Expected: the standalone window closes.

6. Pinned and routed external links
   - With a space routing rule matching the URL, open that URL from another app.
   - Expected: the standalone window is used, and `Open in Space` still lands in a valid space.

7. Beforeunload
   - Open a standalone window on a page with an unsaved-changes prompt.
   - Press `Close`.
   - Expected: exactly one prompt. Cancelling leaves the window open and usable.

8. Private browsing
   - Open an external link while only a private window is open.
   - Expected: the standalone window is private, and keeping it lands in a window that can accept it.

9. No normal window available
   - Open a standalone window, close every other Zen window, then click `Open in Space`.
   - Expected: the action does nothing destructive and the buttons re-enable.
