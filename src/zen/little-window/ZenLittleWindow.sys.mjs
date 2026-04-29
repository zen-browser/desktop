/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { AppConstants } from "resource://gre/modules/AppConstants.sys.mjs";
import { XPCOMUtils } from "resource://gre/modules/XPCOMUtils.sys.mjs";

const lazy = {};

XPCOMUtils.defineLazyServiceGetter(
  lazy,
  "ZenWindowControl",
  "@mozilla.org/zen/window-control;1",
  Ci.nsIZenWindowControl
);

const URLBAR_HEIGHT = 340;
const URLBAR_WIDTH = 640;

const FEATURES =
  "titlebar,close,toolbar,location,personalbar=no,status,menubar=no," +
  `resizable,minimizable,scrollbars,width=${URLBAR_WIDTH},height=${URLBAR_HEIGHT},centerscreen`;

class nsZenLittleWindow {
  init() {}
  uninit() {}

  /**
   * Open a fresh little window, or focus an existing empty one if there
   * already is a little window sitting on its empty tab.
   *
   * @param {Window} opener The browser window asking for the little window.
   * @returns {Window|null} The window that received focus.
   */
  openLittleWindow(opener) {
    for (const win of this.#iterLittleWindows()) {
      if (this.#isOnEmptyTab(win)) {
        win.focus();
        return win;
      }
    }
    let win = opener.OpenBrowserWindow({
      zenLittleWindow: true,
      all: false,
      features: FEATURES,
    });
    win.windowUtils.suppressAnimation(true);
      // Hide the OS-level window until the floating urlbar is ready, so the
      // user never sees a half-laid-out chrome flash on top.
      lazy.ZenWindowControl.hide(win);
    return win;
  }

  #isLittleWindow(win) {
    return (
      !!win._zenStartupLittleWindow ||
      win.document?.documentElement?.hasAttribute("zen-little-window")
    );
  }

  #isOnEmptyTab(win) {
    const tab = win.gBrowser?.selectedTab;
    return !!tab?.hasAttribute("zen-empty-tab");
  }

  *#iterLittleWindows() {
    const en = Services.wm.getEnumerator("navigator:browser");
    while (en.hasMoreElements()) {
      const win = en.getNext();
      if (!win.closed && this.#isLittleWindow(win)) {
        yield win;
      }
    }
  }

  onLittleWindow(win) {
    if (!this.#isLittleWindow(win)) {
      return;
    }
    const observer = new win.ResizeObserver(entries => {
      if (win.closed) {
        return;
      }
      for (const entry of entries) {
        if (entry.target.id === "urlbar") {
          const { width, height } = entry.target.getBoundingClientRect();
          win.resizeTo(width, height);
        }
      }
    });
    const onClosed = event => {
      observer.disconnect();
      if (!win.closed && !event.detail?.onElementPicked) {
        lazy.ZenWindowControl.hide(win);
        win.close();
      } else {
        const [width, height] = [1000, 600];
        win.setResizable(true);
        win.resizeTo(1000, 600);
win.docShell.treeOwner
        .QueryInterface(Ci.nsIInterfaceRequestor)
        .getInterface(Ci.nsIAppWindow)
        .center(null, true, true)
      }
    };
    const urlbar = win.gURLBar;
    observer.observe(urlbar);
    // TODO: Handle window blur event
    win.setResizable(false);
    win.addEventListener(
      "ZenFloatingURLBarOpened",
      () => {
win.docShell.treeOwner
        .QueryInterface(Ci.nsIInterfaceRequestor)
        .getInterface(Ci.nsIAppWindow)
        .center(null, true, true)
        if (AppConstants.platform == "macosx" && !Services.focus.activeWindow) {
          Cc["@mozilla.org/widget/macdocksupport;1"]
            .getService(Ci.nsIMacDockSupport)
            .activateApplication(true);
        }
        win.focus();
        urlbar.focus();
      },
      { once: true }
    );
    win.addEventListener("ZenURLBarClosed", onClosed, { once: true });
    win.addEventListener("unload", () => observer.disconnect(), { once: true });
    // Hacky, but used to prevent flashing and still being able to render
    lazy.ZenWindowControl.show(win);
    lazy.ZenWindowControl.hide(win);
    win.gZenWorkspaces.promiseInitialized.then(() => {
      win.windowUtils.suppressAnimation(false);
      lazy.ZenWindowControl.show(win);
    });
  }
}

export const ZenLittleWindow = new nsZenLittleWindow();
