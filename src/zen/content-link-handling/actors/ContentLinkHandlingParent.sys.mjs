// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

/* eslint-disable consistent-return */

import { AppConstants } from "resource://gre/modules/AppConstants.sys.mjs";
import { E10SUtils } from "resource://gre/modules/E10SUtils.sys.mjs";

export class ContentLinkHandlingParent extends JSWindowActorParent {
  constructor() {
    super();
  }

  async receiveMessage(message) {
    if (
      message.name !== "ContentLinkHandling:OpenSplitLink" &&
      message.name !== "ContentLinkHandling:OpenLink" &&
      !Services.prefs.getBoolPref("zen.glance.enabled", true)
    ) {
      return;
    }
    switch (message.name) {
      case "ContentLinkHandling:OpenLink":
        this.openLink(message.data);
        break;
      case "ContentLinkHandling:OpenSplitLink": {
        this.openSplitLink(message.data);
        break;
      }
      case "ContentLinkHandling:OpenGlance": {
        this.openGlance(this.browsingContext.topChromeWindow, message.data);
        break;
      }
      case "ContentLinkHandling:CloseGlance": {
        // Explicitly allowlist fields from content; never forward
        // skipPermitUnload or other privileged flags.
        const { noAnimation, setNewID, hasFocused } = message.data ?? {};
        this.browsingContext.topChromeWindow.gZenGlanceManager.closeGlance({
          onTabClose: true,
          noAnimation: !!noAnimation,
          setNewID: typeof setNewID === "string" ? setNewID : null,
          hasFocused: !!hasFocused,
        });
        break;
      }
      case "ContentLinkHandling:RecordLinkClickData": {
        this.browsingContext.topChromeWindow.gZenGlanceManager.lastLinkClickData =
          message.data;
        break;
      }
      default:
        console.warn(
          `[content-link-handling]: Unknown message: ${message.name}`,
        );
    }
  }

  openLink(data) {
    if (
      !["tab", "window", "current"].includes(data?.action) ||
      typeof data.href !== "string"
    ) {
      return;
    }
    const principal = this.manager.documentPrincipal;
    try {
      if (Services.io.extractScheme(data.href) === "javascript") {
        return;
      }
      Services.scriptSecurityManager.checkLoadURIStrWithPrincipal(
        principal,
        data.href,
      );
    } catch {
      return;
    }
    if (data.action !== "current") {
      // Reuse Firefox's opening path for referrers, containers, private browsing,
      // history and tab focus. Only the modifier mapping is changed.
      this.manager.getActor("ClickHandler").receiveMessage({
        name: "Content:Click",
        data: {
          href: data.href,
          referrerInfo: data.referrerInfo,
          policyContainer: data.policyContainer,
          button: 0,
          shiftKey: data.action === "window",
          ctrlKey: data.action === "tab" && AppConstants.platform !== "macosx",
          metaKey: data.action === "tab" && AppConstants.platform === "macosx",
          altKey: false,
        },
      });
      return;
    }
    const browser = this.browsingContext.top.embedderElement;
    if (!browser) {
      return;
    }
    browser.documentGlobal.openLinkIn(data.href, "current", {
      targetBrowser: browser,
      triggeringPrincipal: principal,
      originPrincipal: principal,
      originStoragePrincipal: this.manager.documentStoragePrincipal,
      userContextId: principal.originAttributes.userContextId,
      referrerInfo: E10SUtils.deserializeReferrerInfo(data.referrerInfo),
      policyContainer: data.policyContainer
        ? E10SUtils.deserializePolicyContainer(data.policyContainer)
        : null,
      triggeringRemoteType: this.manager.domProcess?.remoteType,
      hasValidUserGestureActivation: true,
    });
  }

  openSplitLink(data) {
    const url = data?.url;
    try {
      if (
        typeof url !== "string" ||
        Services.io.extractScheme(url) === "javascript"
      ) {
        return;
      }
    } catch {
      return;
    }
    const window = this.browsingContext.topChromeWindow;
    const browser = this.browsingContext.top.embedderElement;
    const sourceTab = window?.gBrowser?.getTabForBrowser(browser);
    if (!sourceTab || !window.gZenViewSplitter) {
      return;
    }
    window.gZenViewSplitter.openLinkInSplit(
      url,
      this.manager.documentPrincipal,
      sourceTab,
    );
  }

  openGlance(window, data) {
    return window.gZenGlanceManager.openGlance(data);
  }
}
