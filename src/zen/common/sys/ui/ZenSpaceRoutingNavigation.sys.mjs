// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { ZenUIComponent } from "resource:///modules/zen/ui/ZenUIComponent.sys.mjs";

/**
 * Per-window listener that re-routes in-place navigations for Space Routing.
 *
 * When any top-level navigation (link click, address bar, JS redirect, form
 * submit, ...) targets a URL whose rule points at a *different* space than the
 * one the tab currently lives in, the load is cancelled and re-opened in a new
 * tab. The new tab flows through tabbrowser's addTab() routing, which moves it
 * into the matching space.
 */
export class ZenSpaceRoutingNavigation extends ZenUIComponent {
  init() {
    this.listenBrowserTabsProgress();
  }

  /**
   * @param {MozBrowser} aBrowser - The browser the state change happened in
   * @param {nsIWebProgress} aWebProgress - The web progress
   * @param {nsIRequest} aRequest - The request driving the state change
   * @param {number} aStateFlags - The nsIWebProgressListener state flags
   */
  onStateChange(aBrowser, aWebProgress, aRequest, aStateFlags) {
    const wpl = Ci.nsIWebProgressListener;
    if (
      !aWebProgress?.isTopLevel ||
      !(aStateFlags & wpl.STATE_START) ||
      !(aStateFlags & wpl.STATE_IS_DOCUMENT) ||
      aStateFlags & wpl.STATE_RESTORING
    ) {
      return;
    }

    let uri;
    try {
      uri = aRequest.QueryInterface(Ci.nsIChannel).URI;
    } catch (e) {
      return;
    }
    if (!uri || !(uri.schemeIs("http") || uri.schemeIs("https"))) {
      return;
    }

    // Don't disturb a tab that is merely (re)loading the page it already shows:
    // a reload, a session restore, or a tab that was already sitting on this URL
    // before the rule was set. At STATE_START the browser's currentURI still
    // points at the existing document, so an equal target means this isn't a
    // new navigation worth routing.
    let currentURI = null;
    try {
      currentURI = aBrowser.currentURI;
    } catch (e) {
      currentURI = null;
    }
    if (currentURI?.equals(uri)) {
      return;
    }

    const win = this.window;
    const gBrowser = win.gBrowser;
    const tab = gBrowser.getTabForBrowser(aBrowser);
    if (
      !tab ||
      tab.pinned ||
      tab.hasAttribute("zen-empty-tab") ||
      tab.hasAttribute("zen-glance-tab")
    ) {
      return;
    }

    const currentWorkspaceId = tab.getAttribute("zen-workspace-id");
    const targetWorkspaceId =
      win.gZenSpaceRoutingManager.getRedirectTargetWorkspaceId(
        uri.spec,
        currentWorkspaceId,
        win
      );
    if (!targetWorkspaceId) {
      return;
    }

    // A brand-new tab whose very first real navigation this is (a
    // target="_blank" link, window.open(), or a freshly opened tab) is still
    // showing its initial about:blank document. There is nothing to preserve,
    // so rather than cancelling the load and spawning a duplicate tab - which
    // would leave this one behind empty - just move this very tab into the
    // destination space and let the in-flight load finish in place.
    const isInitialDocument =
      aBrowser.browsingContext?.currentWindowGlobal?.isInitialDocument ?? false;
    if (isInitialDocument) {
      const wasSelected = tab.selected;
      // Defer so we don't mutate the tab strip from inside a progress notification.
      win.setTimeout(() => {
        if (!tab.isConnected) {
          return;
        }
        gBrowser.selectedTab = tab.owner;
        win.gZenWorkspaces.moveTabToWorkspace(tab, targetWorkspaceId);
        if (wasSelected) {
          const targetWorkspace =
            win.gZenWorkspaces.getWorkspaceFromId(targetWorkspaceId);
          if (targetWorkspace) {
            win.gZenWorkspaces.lastSelectedWorkspaceTabs[targetWorkspaceId] =
              tab;
            win.gZenWorkspaces.changeWorkspace(targetWorkspace);
          }
        }
      }, 0);
      return;
    }

    // An already-loaded page is navigating in place. Preserve it in its current
    // tab and re-open the destination in a new routed tab instead.
    //
    // Under Fission the parent-side aRequest is a RemoteWebProgress stand-in
    // whose cancel()/loadInfo throw NS_ERROR_NOT_IMPLEMENTED (the real channel
    // lives in the content process). Stop the in-place load through the browser,
    // which proxies the request to the content process.
    try {
      aBrowser.stop();
    } catch (e) {
      return;
    }

    const urlToOpen = uri.spec;

    // loadInfo isn't reachable on the remote request, so use the navigating
    // page as the triggering principal (correct for link clicks), with a null
    // principal as the safe last resort.
    const principal =
      aBrowser.contentPrincipal ||
      Services.scriptSecurityManager.createNullPrincipal({});

    // Defer so we don't mutate the tab strip from inside a progress notification.
    win.setTimeout(() => {
      gBrowser.addTab(urlToOpen, {
        triggeringPrincipal: principal,
        ownerTab: tab.isConnected ? tab : null,
        // The user was actively navigating this tab, so follow the navigation
        // into the routed tab instead of opening it in the background (addTab
        // defaults inBackground to true).
        inBackground: false,
      });
    }, 0);
  }
}
