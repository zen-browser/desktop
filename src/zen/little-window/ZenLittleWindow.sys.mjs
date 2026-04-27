/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const URLBAR_HEIGHT = 340;
const URLBAR_WIDTH = 640;

const FEATURES =
  "titlebar,close,toolbar,location,personalbar=no,status,menubar=no," +
  `resizable,minimizable,scrollbars,width=${URLBAR_WIDTH},height=${URLBAR_HEIGHT},centerscreen`;

class nsZenLittleWindow {
  #initialized = false;

  init() {
    if (this.#initialized) {
      return;
    }
    this.#initialized = true;
    Services.obs.addObserver(this, "browser-window-before-show");
  }

  uninit() {
    if (!this.#initialized) {
      return;
    }
    this.#initialized = false;
    try {
      Services.obs.removeObserver(this, "browser-window-before-show");
    } catch (e) {}
  }

  observe(subject, topic) {
    if (
      topic === "browser-window-before-show" &&
      this.#isLittleWindow(subject)
    ) {
      this.#attachAutoclose(subject);
    }
  }

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
    if (typeof opener?.OpenBrowserWindow !== "function") {
      return null;
    }
    let win = opener.OpenBrowserWindow({
      zenLittleWindow: true,
      all: false,
      features: FEATURES,
    });
    win.focus();
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

  #attachAutoclose(win) {
    const onClosed = event => {
      if (event.detail?.onElementPicked && event.type === "ZenURLBarClosed") {
        return;
      }
      if (!win.closed && this.#isOnEmptyTab(win)) {
        win.close();
      } else {
        // Resize window back to normal size
        win.resizeTo(1240, 840);
      }
    };
    win.document.documentElement.setAttribute("zen-little-window", "true");
    win.resizeTo(URLBAR_WIDTH, URLBAR_HEIGHT);
    win.focus();
    win.addEventListener("ZenURLBarClosed", onClosed, { once: true });
    win.addEventListener("blur", onClosed, { once: true });
  }
}

export const ZenLittleWindow = new nsZenLittleWindow();
