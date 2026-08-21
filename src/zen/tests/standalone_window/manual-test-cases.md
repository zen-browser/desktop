# External Link Standalone Window Manual Test Cases

## Setup

1. Enable `zen.standalone-window.enabled`.
2. Keep one normal Zen window open with workspaces enabled.
3. Run a freshly rebuilt executable and record its build ID. Do not validate
   native window behavior against an older object-directory binary.

## Release blockers

The feature must not ship unless all of these pass:

1. Put ChatGPT, Finder, and a normal Zen window in front of the standalone.
   - Expected: each can cover it normally; the standalone is not floating or
     always-on-top.
2. Open Mission Control and use `Command+backtick` window cycling.
   - Expected: the standalone appears and cycles as an independent Zen window.
3. Inspect the standalone page with Browser Toolbox.
   - Expected: `gZenWorkspaces.shouldHaveWorkspaces` and `workspaceEnabled` are
     false, `gZenWorkspaces.getWorkspaces()` is empty, and the selected tab has
     no `zen-workspace-id` or `zen-empty-tab`.
4. Press `Command+W` once.
   - Expected: the native standalone window closes. No empty shell, replacement
     tab, or Default space remains.
5. Repeat close using the red traffic light and the menu Close command.
   - Expected: all three entry points have the same unload, recovery, cleanup,
     and focus behavior.
6. Move and resize a standalone window, close it, then open another external
   link.
   - Expected: the new standalone restores the previous normal window size and
     placement. If several standalone windows are open together, later windows
     cascade from that saved placement.
   - Expected: opening a regular Zen window still uses the regular window's own
     last size and placement.
7. Promote through the primary action and through a picker-selected space.
   - Expected: the existing UI and live-page move behavior remain unchanged.

## Cases

1. External app link
   - Open a link from another app, such as Mail, Slack, or Terminal `open`.
   - Expected: Zen opens a standalone window, not a normal workspace tab.
   - Expected: the standalone window has no sidebar, tab strip or bookmarks toolbar, and no sidebar flashes on the way in.
   - Expected: the URL bar is present and editable.

2. Top bar contents
   - Look at the top bar of a fresh standalone window.
   - Expected: window controls, then the address bar, then `Open in <Space> ⌘O` with a chevron. Nothing else.
   - Expected: no forward, reload or home button, no extensions or account button, no overflow chevron, no app menu.
   - Expected: the window controls sit on the same line as the address bar, vertically centred.
   - Expected: dragging the empty part of the bar moves the window.

3. Conditional back arrow
   - On a fresh standalone window, look between the window controls and the address bar.
   - Expected: no back arrow.
   - Follow a link inside the window.
   - Expected: a back arrow appears in that gap, and going back to the first page removes it again.

4. Multiple standalone windows
   - Open two different links from another app.
   - Expected: two separate standalone windows, offset from each other rather than stacked.

5. Close without keeping
   - Open a standalone window and close it from the window controls.
   - Expected: no new tab is added to any normal Zen workspace.

6. Keep in default space
   - Open a standalone window, follow a couple of links inside it, then click `Open in Space`.
   - Expected: the page opens as a selected normal tab in the space that was active when the link arrived.
   - Expected: the page is not reloaded, and Back still walks the history built inside the standalone window.
   - Expected: the standalone window closes.

7. Space picker appearance
   - Give two spaces different themes, then open the picker from the chevron.
   - Expected: a borderless search row with a magnifier and a collapse button, then one row per space.
   - Expected: each row leads with a rounded tile in that space's own accent colour, holding its emoji or icon.
   - Expected: the current space's row is subtly highlighted, and the collapse button closes the panel.
   - Type a string no space matches.
   - Expected: the list empties and a "No spaces match that search" line appears.

8. Keep in selected space
   - Create at least two workspaces.
   - Open a standalone window, click `Choose Space` and select a non-current workspace.
   - Expected: the page becomes a tab assigned to the selected workspace, and Zen switches to it.
   - Expected: the standalone window closes.

9. Pinned and routed external links
   - With a space routing rule matching the URL, open that URL from another app.
   - Expected: the standalone window is used, and `Open in Space` still lands in a valid space.

10. Beforeunload
   - Open a standalone window on a page with an unsaved-changes prompt.
   - Close it from the window controls.
   - Expected: exactly one prompt. Cancelling leaves the window open and usable.

11. Private browsing
   - Open an external link while only a private window is open.
   - Expected: the standalone window is private, and keeping it lands in a window that can accept it.

12. No normal window available
   - Open a standalone window, close every other Zen window, then click `Open in Space`.
   - Expected: a normal Zen window opens, carrying the session that was held back, and the page lands in it as a tab.

13. Restart
   - Open two standalone windows, then quit Zen with them open and start it again.
   - Expected: the normal windows come back exactly as before. Neither standalone window reopens, in a "Default" space or anywhere else.

14. Undo close
   - Open a standalone window, close it from the window controls, then press cmd+shift+T in a normal window.
   - Expected: the page comes back as an ordinary tab in the space that is current, not as a standalone window.
   - Expected: pressing it again walks further back through normal closed tabs.

15. Zen not running
   - Quit Zen. From another app, open a link.
   - Expected: Zen starts and shows the standalone window only. No normal window, and no space is restored behind it.
   - Expected: `Open in Space` opens a normal window with the previous session in it and files the page there.

16. Focus on open (macOS)
   - With Zen in the background and another app in front, open a link from that app.
   - Expected: the standalone window is what comes forward. Zen's normal windows are not pulled onto the current Space.

17. Focus on close (macOS)
   - Following on from case 16, close the standalone window from the window controls.
   - Expected: the app the link came from is frontmost again, not Zen.
   - Repeat, but click into a normal Zen window before closing the standalone one.
   - Expected: Zen stays frontmost, because that is where the user was working.
   - Repeat with two standalone windows open, closing only one.
   - Expected: Zen stays frontmost and the other standalone window is still there.
