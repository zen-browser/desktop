/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Peppermint's additions to Reader Mode in a browser window: a button in the
 * site panel that saves the article being read for offline use, and the
 * entry points that open the saved articles page.
 *
 * Which pages offer Reader Mode is decided in PeppermintReaderAvailability,
 * which a small patch in AboutReaderParent consults.
 */

import { inlineArticleImages } from "moz-src:///peppermint/reader/PeppermintReaderImages.sys.mjs";
import { isSavableUrl } from "moz-src:///peppermint/reader/PeppermintReaderAvailability.sys.mjs";
import {
  STORE_CHANGED_TOPIC,
  getArticle,
  hasArticle,
  removeArticle,
  saveArticle,
} from "moz-src:///peppermint/reader/PeppermintReaderStore.sys.mjs";

const lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  AboutReaderParent: "resource:///actors/AboutReaderParent.sys.mjs",
  PrivateBrowsingUtils: "resource://gre/modules/PrivateBrowsingUtils.sys.mjs",
  ReaderMode: "moz-src:///toolkit/components/reader/ReaderMode.sys.mjs",
});

export const SAVED_ARTICLES_URL = "about:saved";

const FTL_FILE = "browser/peppermint-reader.ftl";
const STYLE_URL = "chrome://browser/content/zen-styles/peppermint-reader.css";
const SAVE_BUTTON_ID = "peppermint-reader-save-button";
const SITE_PANEL_ID = "zen-unified-site-data-panel";
const SITE_HEADER_ID = "zen-site-data-header";
const READER_HEADER_BUTTON_ID = "zen-site-data-header-reader-mode";
const TOAST_TIMEOUT_MS = 2200;

/**
 * @param {XULBrowserElement} browser
 * @returns {string|null} The address of the page shown in Reader Mode, or
 *   null when the tab is not showing one
 */
function readerSourceUrl(browser) {
  const spec = browser?.currentURI?.spec;
  if (!spec?.startsWith("about:reader?")) {
    return null;
  }
  return lazy.ReaderMode.getOriginalUrl(spec);
}

function isPrivateWindow(win) {
  return lazy.PrivateBrowsingUtils.isWindowPrivate(win);
}

function toast(win, messageId) {
  win?.gZenUIManager?.showToast(messageId, {
    timeout: TOAST_TIMEOUT_MS,
    frosted: true,
  });
}

/**
 * Per-window state: the save button and what keeps it in step with the tab.
 */
class ReaderWindow {
  #win;
  #button = null;
  #saving = false;
  #refreshToken = 0;

  constructor(win) {
    this.#win = win;
  }

  init() {
    const win = this.#win;
    const doc = win.document;
    win.MozXULElement.insertFTLIfNeeded(FTL_FILE);
    if (!doc.querySelector(`link[href="${STYLE_URL}"]`)) {
      const link = doc.createElement("link");
      link.rel = "stylesheet";
      link.href = STYLE_URL;
      (doc.querySelector("linkset") || doc.documentElement).appendChild(link);
    }

    const header = doc.getElementById(SITE_HEADER_ID);
    if (!header) {
      console.warn("Reader: the site panel header was not found");
      return;
    }
    this.#button = doc.createXULElement("toolbarbutton");
    this.#button.id = SAVE_BUTTON_ID;
    this.#button.classList.add("zen-squircle-before");
    this.#button.setAttribute("flex", "1");
    this.#button.setAttribute("closemenu", "none");
    this.#button.setAttribute("disabled", "true");
    doc.l10n.setAttributes(this.#button, "peppermint-reader-save-button");
    this.#button.addEventListener("command", this);
    const readerButton = doc.getElementById(READER_HEADER_BUTTON_ID);
    if (readerButton?.parentNode === header) {
      readerButton.after(this.#button);
    } else {
      header.appendChild(this.#button);
    }

    doc.getElementById(SITE_PANEL_ID)?.addEventListener("popupshowing", this);
    win.gBrowser.tabContainer.addEventListener("TabSelect", this);
    win.gBrowser.addProgressListener(this.#progressListener);
    Services.obs.addObserver(this, STORE_CHANGED_TOPIC);
    win.addEventListener("unload", () => this.#destroy(), { once: true });
    this.refresh();
  }

  #destroy() {
    Services.obs.removeObserver(this, STORE_CHANGED_TOPIC);
  }

  #progressListener = {
    QueryInterface: ChromeUtils.generateQI([
      "nsIWebProgressListener",
      "nsISupportsWeakReference",
    ]),
    onStateChange: (webProgress, request, flags) => {
      const done =
        Ci.nsIWebProgressListener.STATE_STOP |
        Ci.nsIWebProgressListener.STATE_IS_WINDOW;
      if (!webProgress.isTopLevel || (flags & done) !== done) {
        return;
      }
      // The content type is only known once the page has loaded, so ask
      // again whether Reader Mode is on offer.
      const browser = webProgress.browsingContext?.embedderElement;
      if (browser && browser === this.#win.gBrowser.selectedBrowser) {
        try {
          lazy.AboutReaderParent.updateReaderButton(browser);
        } catch {
          // The page went away or has no reader actor.
        }
      }
    },
    onLocationChange: webProgress => {
      if (webProgress.isTopLevel) {
        this.refresh();
      }
    },
    onProgressChange() {},
    onStatusChange() {},
    onSecurityChange() {},
    onContentBlockingEvent() {},
  };

  handleEvent(event) {
    switch (event.type) {
      case "command":
        PeppermintReader.toggleSaveCurrent(this.#win);
        break;
      case "popupshowing":
      case "TabSelect":
        this.refresh();
        break;
    }
  }

  observe() {
    this.refresh();
  }

  get saving() {
    return this.#saving;
  }

  set saving(value) {
    this.#saving = value;
    this.refresh();
  }

  /**
   * Bring the button in line with the selected tab: usable only while an
   * article is open in Reader Mode, and showing whether it is saved.
   */
  async refresh() {
    const button = this.#button;
    if (!button || this.#win.closed) {
      return;
    }
    const token = ++this.#refreshToken;
    const browser = this.#win.gBrowser.selectedBrowser;
    const url = readerSourceUrl(browser);
    const usable = !!url && isSavableUrl(url) && !isPrivateWindow(this.#win);
    const saved = usable && (await hasArticle(url));
    if (token !== this.#refreshToken) {
      return;
    }
    button.disabled = !usable || this.#saving;
    button.classList.toggle("active", saved);
    button.toggleAttribute("saving", this.#saving);
    button.setAttribute("aria-pressed", String(saved));
    this.#win.document.l10n.setAttributes(
      button,
      saved
        ? "peppermint-reader-unsave-button"
        : "peppermint-reader-save-button"
    );
  }
}

const windows = new WeakMap();
const pendingWindows = new WeakSet();

function attachWindow(win) {
  if (win.closed || windows.has(win)) {
    return;
  }
  const controller = new ReaderWindow(win);
  windows.set(win, controller);
  controller.init();
}

export const PeppermintReader = {
  /**
   * Set up Reader Mode additions in a browser window.
   *
   * @param {Window} win
   */
  init(win) {
    if (!win || win.closed || windows.has(win) || pendingWindows.has(win)) {
      return;
    }
    if (win.gBrowserInit?.delayedStartupFinished) {
      attachWindow(win);
      return;
    }
    // Startup calls this before the tab browser exists, so wait for it.
    pendingWindows.add(win);
    const observer = {
      observe(subject, topic) {
        if (subject !== win) {
          return;
        }
        Services.obs.removeObserver(observer, topic);
        pendingWindows.delete(win);
        attachWindow(win);
      },
    };
    Services.obs.addObserver(observer, "browser-delayed-startup-finished");
    win.addEventListener(
      "unload",
      () => {
        try {
          Services.obs.removeObserver(
            observer,
            "browser-delayed-startup-finished"
          );
        } catch {
          // Already removed once startup finished.
        }
      },
      { once: true }
    );
  },

  /**
   * @param {Window} win
   * @returns {boolean} An article is open in Reader Mode in a window that
   *   can save it
   */
  canSaveCurrent(win) {
    const url = readerSourceUrl(win.gBrowser?.selectedBrowser);
    return !!url && isSavableUrl(url) && !isPrivateWindow(win);
  },

  /**
   * Fetch the article that the selected tab shows in Reader Mode.
   *
   * @param {Window} win
   * @returns {Promise<object|null>}
   */
  async getCurrentArticle(win) {
    const browser = win.gBrowser.selectedBrowser;
    if (!readerSourceUrl(browser)) {
      return null;
    }
    const actor =
      browser.browsingContext?.currentWindowGlobal?.getActor("AboutReader");
    return (await actor?.sendQuery("Reader:GetArticle")) ?? null;
  },

  /**
   * Save the article shown in Reader Mode, or remove it when it is already
   * saved.
   *
   * @param {Window} win
   * @returns {Promise<"saved"|"removed"|"unavailable"|"error">}
   */
  async toggleSaveCurrent(win) {
    const controller = windows.get(win);
    if (!this.canSaveCurrent(win) || controller?.saving) {
      return "unavailable";
    }
    const url = readerSourceUrl(win.gBrowser.selectedBrowser);
    if (controller) {
      controller.saving = true;
    }
    try {
      if (await hasArticle(url)) {
        await removeArticle(url);
        toast(win, "peppermint-reader-removed-toast");
        return "removed";
      }
      const article = await this.getCurrentArticle(win);
      if (!article) {
        toast(win, "peppermint-reader-error-toast");
        return "unavailable";
      }
      // Reader Mode shows the page's current address; saving under the
      // address the user opened keeps it the one they will look for.
      const { article: prepared } = await inlineArticleImages({
        ...article,
        url,
      });
      await saveArticle(prepared, { isPrivate: isPrivateWindow(win) });
      toast(win, "peppermint-reader-saved-toast");
      return "saved";
    } catch (error) {
      console.error("Reader: the article could not be saved", error);
      toast(win, "peppermint-reader-error-toast");
      return "error";
    } finally {
      if (controller) {
        controller.saving = false;
      }
    }
  },

  /**
   * Open the saved articles page in a new tab.
   *
   * @param {Window} win
   */
  openSavedArticles(win) {
    win.openTrustedLinkIn(SAVED_ARTICLES_URL, "tab");
  },

  /**
   * Show a saved article in Reader Mode. The article is handed to the reader
   * page directly, so it opens without a network.
   *
   * @param {Window} win
   * @param {string} id - The saved article's id
   * @param {"current"|"tab"} [where]
   * @returns {Promise<boolean>} The article was found and opened
   */
  async openArticle(win, id, where = "current") {
    const article = await getArticle(id);
    if (!article) {
      return false;
    }
    lazy.AboutReaderParent.cacheArticle(article.url, article);
    win.openTrustedLinkIn(
      `about:reader?url=${encodeURIComponent(article.url)}`,
      where
    );
    return true;
  },

  /**
   * Tell the user that a page has no text Reader Mode could extract.
   *
   * @param {XULBrowserElement} browser
   */
  onNoReadableText(browser) {
    toast(browser?.ownerGlobal, "peppermint-reader-no-text-toast");
  },
};
