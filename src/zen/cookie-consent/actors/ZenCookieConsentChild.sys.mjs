// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import {
  hideConsent,
  inspectConsent,
  isConsentFrameHost,
  markClicked,
  markManaged,
  nodeMayContainConsent,
} from "resource:///modules/zen/cookieconsent/ZenCookieConsentEngine.sys.mjs";

const MAX_SCANS = 6;
const QUIET_MS = 7000;
const HARD_STOP_MS = 8000;
const IDLE_TIMEOUT_MS = 300;

export class ZenCookieConsentChild extends JSWindowActorChild {
  #destroyed = false;
  #done = false;
  #allowed = null;
  #scans = 0;
  #observer = null;
  #timers = [];
  #scanning = false;
  #queued = false;
  #doc = null;
  #sawCandidate = false;

  handleEvent(event) {
    if (event.type !== "DOMContentLoaded" && event.type !== "pageshow") {
      return;
    }
    if (event.type === "pageshow" && event.persisted) {
      this.#doc = null;
    }
    this.#scheduleInitial();
  }

  didDestroy() {
    this.#destroyed = true;
    this.#finish();
  }

  #clearTimers() {
    const pending = this.#timers;
    this.#timers = [];
    for (const cancel of pending) {
      try {
        cancel();
      } catch {
        // The window may already be gone.
      }
    }
  }

  #scheduleInitial() {
    if (this.#destroyed) {
      return;
    }
    const doc = this.document;
    if (!doc || this.#doc === doc) {
      return;
    }
    const win = this.contentWindow;
    if (!win) {
      return;
    }
    this.#clearTimers();
    this.#observer?.disconnect();
    this.#observer = null;
    this.#doc = doc;
    this.#done = false;
    this.#allowed = null;
    this.#scans = 0;
    this.#sawCandidate = false;
    this.#queued = false;
    if (!this.#frameShouldRun(doc)) {
      this.#finish();
      return;
    }
    this.#armHardStop(win);
    const run = () => this.#scan();
    if (win.requestIdleCallback) {
      const id = win.requestIdleCallback(run, { timeout: IDLE_TIMEOUT_MS });
      this.#timers.push(() => win.cancelIdleCallback?.(id));
    }
    const timer = win.setTimeout(run, IDLE_TIMEOUT_MS);
    this.#timers.push(() => win.clearTimeout(timer));
  }

  #armHardStop(win) {
    const timer = win.setTimeout(() => this.#finish(), HARD_STOP_MS);
    this.#timers.push(() => win.clearTimeout(timer));
  }

  #schedule(delay) {
    if (this.#destroyed || this.#done) {
      return;
    }
    const win = this.contentWindow;
    if (!win) {
      return;
    }
    const timer = win.setTimeout(() => this.#scan(), delay);
    this.#timers.push(() => win.clearTimeout(timer));
  }

  #armQuietStop() {
    if (this.#sawCandidate || this.#done) {
      return;
    }
    const win = this.contentWindow;
    if (!win) {
      return;
    }
    const timer = win.setTimeout(() => {
      if (!this.#sawCandidate) {
        this.#finish();
      }
    }, QUIET_MS);
    this.#timers.push(() => win.clearTimeout(timer));
  }

  #isTopFrame() {
    const context = this.browsingContext;
    return !!context && context.top === context;
  }

  /**
   * Banners live in the top document. Subframes only run for hosts that
   * embed a known consent manager, so ordinary ad and widget frames do not
   * start the scanner.
   */
  #frameShouldRun(doc) {
    if (this.#isTopFrame()) {
      return true;
    }
    try {
      return isConsentFrameHost(new URL(doc.documentURI).hostname);
    } catch {
      return false;
    }
  }

  #watch(doc) {
    if (this.#observer || !this.#isTopFrame() || this.#done) {
      return;
    }
    const win = this.contentWindow;
    if (!doc?.documentElement || !win?.MutationObserver) {
      return;
    }
    this.#observer = new win.MutationObserver(records => {
      if (this.#done || this.#scans >= MAX_SCANS) {
        return;
      }
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (node.nodeType !== 1) {
            continue;
          }
          let matched = false;
          try {
            matched = nodeMayContainConsent(node);
          } catch {
            matched = false;
          }
          if (matched) {
            this.#schedule(150);
            return;
          }
        }
      }
    });
    this.#observer.observe(doc.documentElement, {
      childList: true,
      subtree: true,
    });
  }

  async #scan() {
    if (this.#destroyed || this.#done) {
      return;
    }
    if (this.#scanning) {
      this.#queued = true;
      return;
    }
    this.#scanning = true;
    try {
      await this.#scanOnce();
    } finally {
      this.#scanning = false;
      if (this.#queued && !this.#done && !this.#destroyed) {
        this.#queued = false;
        this.#scan();
      }
    }
  }

  async #scanOnce() {
    if (this.#scans >= MAX_SCANS) {
      this.#finish();
      return;
    }
    const doc = this.document;
    if (!doc || doc.nodePrincipal?.isSystemPrincipal) {
      return;
    }
    const url = doc.documentURI || "";
    if (!url.startsWith("http:") && !url.startsWith("https:")) {
      return;
    }
    if (this.#allowed === null) {
      try {
        const result = await this.sendQuery("ZenCookieConsent:ShouldRun", { url });
        this.#allowed = !!result?.run;
      } catch {
        this.#finish();
        return;
      }
      if (!this.#allowed) {
        this.#finish();
        return;
      }
    }
    if (this.#destroyed || this.#done) {
      return;
    }
    this.#scans++;
    const topFrame = this.#isTopFrame();
    const decision = inspectConsent(doc, { topFrame });
    if (decision.action === "none") {
      if (this.#sawCandidate || !topFrame) {
        this.#finish();
        return;
      }
      this.#watch(doc);
      this.#armQuietStop();
      return;
    }
    this.#sawCandidate = true;
    if (topFrame) {
      this.#watch(doc);
    }
    if (decision.action === "click") {
      this.#activate(decision.control);
      markClicked(decision.root);
      this.#schedule(250);
      return;
    }
    if (decision.action === "manage") {
      try {
        this.#activate(decision.control);
      } catch {
        hideConsent(doc, decision.root);
        this.#finish();
        return;
      }
      markManaged(decision.root);
      this.#schedule(400);
      return;
    }
    hideConsent(doc, decision.root);
    this.#finish();
  }

  #activate(control) {
    if (!control) {
      return;
    }
    try {
      if (control.localName === "a") {
        control.addEventListener(
          "click",
          event => event.preventDefault(),
          { capture: true, once: true }
        );
      }
      control.click();
    } catch {
      // The control can be detached between the scan and the click.
    }
  }

  #finish() {
    this.#done = true;
    this.#observer?.disconnect();
    this.#observer = null;
    this.#clearTimers();
  }
}
