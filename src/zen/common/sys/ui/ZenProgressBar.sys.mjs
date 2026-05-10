// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { ZenUIComponent } from "resource:///modules/zen/ui/ZenUIComponent.sys.mjs";

const WAIT_BEFORE_SHOWING_LONG_LOAD = 3000;

export class ZenProgressBar extends ZenUIComponent {
  #element = null;
  #loadingTab = null;
  #longLoadTimer = null;
  #promise = null;

  init() {
    this.listenBrowserTabsProgress();
    this.addEventListener("TabSelect");
  }

  onStateChange(aWebProgress) {
    this.#checkBrowserProgress(aWebProgress);
  }

  onLocationChange(webProgress) {
    this.#checkBrowserProgress(webProgress);
  }

  on_TabSelect() {
    const gBrowser = this.window.gBrowser;
    const selectedTab = gBrowser.selectedTab;
    this.onLocationChange(gBrowser.getBrowserForTab(selectedTab));
  }

  get #progressBar() {
    if (!this.#loadingTab) {
      return null;
    }
    if (!this.#element) {
      this.#element = this.window.document.createXULElement("hbox");
      this.#element.id = "zen-loading-progress-bar";
    }
    if (
      this.#element._loadingTab?.deref() !== this.#loadingTab &&
      this.#loadingTab
    ) {
      this.#element._loadingTab = new WeakRef(this.#loadingTab);
      const container = this.window.document.getElementById(
        this.#loadingTab.linkedPanel
      );
      container.firstChild.before(this.#element);
      this.window.gZenUIManager.elementAnimate(
        this.#element,
        {
          opacity: [0, 0.8],
        },
        {
          duration: 400,
        }
      );
    }
    return this.#element;
  }

  async #checkBrowserProgress(webProgress) {
    await this.#promise;
    const window = this.window;
    const gBrowser = window.gBrowser;
    const tab = gBrowser.getTabForBrowser(webProgress);
    const isLoading =
      tab?.selected &&
      (tab.hasAttribute("busy") || tab.hasAttribute("progress"));
    if (isLoading) {
      this.#showProgressBar(tab);
    } else {
      this.#hideProgressBar();
    }
  }

  #hideProgressBar(aInstant = false) {
    const progressBar = this.#element;
    const window = this.window;
    if (this.#longLoadTimer) {
      window.clearTimeout(this.#longLoadTimer);
      this.#longLoadTimer = null;
    }

    this.#loadingTab = null;
    if (!progressBar) {
      return;
    }
    let { promise, resolve } = Promise.withResolvers();
    this.#promise = promise;
    const callback = () => {
      delete progressBar._loadingTab;
      progressBar.remove();
      this.#element = null;
      resolve();
    };
    if (this.window.gReduceMotion || aInstant) {
      callback();
      return;
    }
    this.window.gZenUIManager
      .elementAnimate(
        progressBar,
        {
          transform: ["scaleX(0.8) translate(-50%, -50%)"],
          opacity: [0],
        },
        {
          duration: 300,
        }
      )
      .then(callback);
  }

  #showProgressBar(aTab) {
    if (this.#loadingTab === aTab) {
      return;
    }
    if (this.#element) {
      return;
    }
    let { promise, resolve } = Promise.withResolvers();
    this.#promise = promise;
    this.#loadingTab = aTab;
    const progressBar = this.#progressBar;
    progressBar.removeAttribute("fade-out");
    progressBar.removeAttribute("long-load");
    this.#longLoadTimer = this.window.setTimeout(() => {
      if (this.#loadingTab === aTab) {
        progressBar.setAttribute("long-load", "true");
      }
      this.#longLoadTimer = null;
    }, WAIT_BEFORE_SHOWING_LONG_LOAD);
    resolve();
  }
}
