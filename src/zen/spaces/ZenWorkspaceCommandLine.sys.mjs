/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  BrowserWindowTracker: "resource:///modules/BrowserWindowTracker.sys.mjs",
});

const WORKSPACE_FLAG = "workspace";
const NEW_TAB_FLAG = "new-tab";

/**
 * Command line handler for `--workspace <name>`.
 *
 * Firefox's own handler sends `--new-tab` to whichever space happens to be
 * active. This handler is registered under the "command-line-handler" category
 * as "b-zen-workspace" so that it is asked first (handlers run in alphabetical
 * order of their category entry name, and Firefox registers itself as
 * "m-browser"). When `--workspace` is present it consumes `--new-tab` as well
 * and opens the URL in the named space instead. When it is absent, the flags
 * are left untouched and Firefox behaves exactly as before.
 *
 * The tab is always opened in the *background* of the target space: the flag
 * exists so a script can lay out several spaces in one go, and switching space
 * per tab would both flicker and leave the user somewhere they did not ask to
 * be. Nothing about the active space changes.
 *
 * An unknown space name is never silently downgraded to the active space; it
 * reports an error and opens nothing.
 */
export class ZenWorkspaceCommandLineHandler {
  QueryInterface = ChromeUtils.generateQI(["nsICommandLineHandler"]);

  /* nsICommandLineHandler */
  handle(cmdLine) {
    const workspaceName = this.#takeFlagWithParam(cmdLine, WORKSPACE_FLAG);
    if (!workspaceName) {
      if (workspaceName === "") {
        this.reportError(
          `--${WORKSPACE_FLAG} needs the name of a space, for example ` +
            `--${WORKSPACE_FLAG} "Work" --${NEW_TAB_FLAG} https://example.com`
        );
      }
      return;
    }

    const uriString = this.#takeFlagWithParam(cmdLine, NEW_TAB_FLAG);
    if (!uriString) {
      // Nothing was consumed that the default handler needed, so leave
      // preventDefault alone and let startup carry on as usual.
      this.reportError(
        `--${WORKSPACE_FLAG} "${workspaceName}" was given without ` +
          `--${NEW_TAB_FLAG} <url>, so there is nothing to open`
      );
      return;
    }

    // From here on `--new-tab` has been taken away from the default handler, so
    // every exit has to stop default handling as well. Otherwise a second
    // instance would fall back to opening a window we were not asked for. This
    // is unconditional for the same reason Firefox's own `--new-tab` branch
    // does it unconditionally: the flag has been claimed either way.
    cmdLine.preventDefault = true;

    let uri;
    try {
      uri = cmdLine.resolveURI(uriString);
    } catch (e) {
      this.reportError(`Could not resolve "${uriString}": ${e}`);
      return;
    }

    // Same guard Firefox applies to externally supplied URIs.
    if (uri.schemeIs("chrome") || uri.schemeIs("moz-extension")) {
      this.reportError(
        `Refusing to open a ${uri.scheme}: URI from the command line`
      );
      return;
    }

    const win = this.getTargetWindow();
    if (!win?.gZenWorkspaces?.workspaceEnabled) {
      this.reportError(
        `--${WORKSPACE_FLAG} needs a running window with spaces enabled; ` +
          `start Zen first, then run the command again`
      );
      return;
    }

    const spaces = win.gZenWorkspaces.getWorkspaces();
    // Space names are not unique. The first match wins, which keeps the flag
    // predictable rather than making the caller guess between duplicates.
    const workspace = spaces.find(space => space.name === workspaceName);
    if (!workspace) {
      const known = spaces.map(space => `"${space.name}"`).join(", ");
      this.reportError(
        `No space named "${workspaceName}". Known spaces: ${known || "(none)"}`
      );
      return;
    }

    this.#openInWorkspace(win, workspace, uri);
  }

  /* nsICommandLineHandler */
  get helpInfo() {
    return (
      "  --workspace <name> Open the URL given with --new-tab in the\n" +
      "                     background of the space named <name>, without\n" +
      "                     switching to it. If two spaces share a name,\n" +
      "                     the first one is used.\n"
    );
  }

  /**
   * The window the tab should be added to. Split out so tests can point the
   * handler at a window of their own.
   *
   * @returns {Window|null} The most recently used browser window
   */
  getTargetWindow() {
    return lazy.BrowserWindowTracker.getTopWindow();
  }

  /**
   * Reports a command line problem. Split out both so that failures are always
   * loud in one place, and so tests can observe them.
   *
   * @param {string} message - What went wrong
   */
  reportError(message) {
    console.error(`[ZenWorkspaceCommandLine]: ${message}`);
  }

  /**
   * Reads and consumes a flag, treating "flag given without a value" as an
   * empty string rather than letting the exception escape.
   *
   * @param {nsICommandLine} cmdLine - The command line being handled
   * @param {string} flag - The flag name, without dashes
   * @returns {string|null} The value, "" when it had none, null when absent
   * @private
   */
  #takeFlagWithParam(cmdLine, flag) {
    try {
      return cmdLine.handleFlagWithParam(flag, false);
    } catch (e) {
      if (e.result != Cr.NS_ERROR_INVALID_ARG) {
        throw e;
      }
      // The flag is still on the command line; take it so nothing else sees it.
      cmdLine.handleFlag(flag, false);
      return "";
    }
  }

  /**
   * Opens the URI as a background tab belonging to the given space.
   *
   * @param {Window} win - The browser window to add the tab to
   * @param {object} workspace - The target space
   * @param {nsIURI} uri - The URI to open
   * @private
   */
  #openInWorkspace(win, workspace, uri) {
    try {
      const tab = win.gBrowser.addTab(uri.spec, {
        inBackground: true,
        // The destination is explicit, so routing rules must not redirect it.
        skipRoute: true,
        // Without this the tab would inherit the *active* space's container.
        userContextId: workspace.containerTabId ?? 0,
        // The command line is as trusted as the user running the browser, which
        // is the same principal Firefox uses for its own --new-tab handling.
        triggeringPrincipal:
          Services.scriptSecurityManager.getSystemPrincipal(),
      });
      win.gZenWorkspaces.moveTabToWorkspace(tab, workspace.uuid);
      win.gZenWorkspaces.lastSelectedWorkspaceTabs[workspace.uuid] = tab;
    } catch (e) {
      this.reportError(
        `Could not open ${uri.spec} in space "${workspace.name}": ${e}`
      );
    }
  }
}
