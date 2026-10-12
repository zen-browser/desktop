// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { VIDEO_PAGE_HOOK } from "resource:///modules/zen/adblock/ZenAdblockVideo.sys.mjs";

const lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  handlePseudoDirective:
    "resource:///modules/zen/adblock/vendor/cosmetics.mjs",
  querySelectorAll: "resource:///modules/zen/adblock/vendor/cosmetics.mjs",
});

const STYLE_ID = "zen-adblock-css";
const SCAN_LIMIT = 2000;
const compiledScripts = new Map();

function compilePageScript(code) {
  let pending = compiledScripts.get(code);
  if (!pending) {
    pending = ChromeUtils.compileScript(
      "data:text/javascript," + encodeURIComponent(code),
      { filename: "zen-adblock-scriptlet.js" }
    );
    compiledScripts.set(code, pending);
  }
  return pending;
}

compilePageScript(VIDEO_PAGE_HOOK);

export class ZenAdblockChild extends JSWindowActorChild {
  #style = null;
  #observer = null;
  #timer = 0;
  #injectedScripts = new Set();
  #destroyed = false;
  #applying = false;
  #pending = false;

  handleEvent(event) {
    if (
      event.type === "DOMDocElementInserted" ||
      event.type === "DOMContentLoaded" ||
      event.type === "pageshow"
    ) {
      this.#apply();
    }
  }

  receiveMessage(message) {
    if (message.name === "ZenAdblock:Refresh") {
      this.#apply();
    }
  }

  didDestroy() {
    this.#destroyed = true;
    this.#observer?.disconnect();
    this.#observer = null;
    const win = this.contentWindow;
    if (win && this.#timer) {
      win.clearTimeout(this.#timer);
    }
  }

  #schedule() {
    if (this.#destroyed) {
      return;
    }
    const win = this.contentWindow;
    if (!win) {
      return;
    }
    if (this.#timer) {
      win.clearTimeout(this.#timer);
    }
    this.#timer = win.setTimeout(() => {
      this.#timer = 0;
      this.#apply();
    }, 50);
  }

  #watch() {
    if (this.#observer || this.#destroyed) {
      return;
    }
    const doc = this.document;
    const win = this.contentWindow;
    if (!doc?.documentElement || !win?.MutationObserver) {
      return;
    }
    this.#observer = new win.MutationObserver(() => this.#schedule());
    this.#observer.observe(doc.documentElement, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["id", "class", "href"],
    });
  }

  async #apply() {
    if (this.#destroyed) {
      return;
    }
    if (this.#applying) {
      this.#pending = true;
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
    this.#applying = true;
    try {
      const result = await this.sendQuery("ZenAdblock:GetCosmetics", {
        url,
        ...this.#collect(doc),
      });
      if (this.#destroyed || !result?.active) {
        if (result && !result.active) {
          this.#style?.remove();
          this.#style = null;
        }
        return;
      }
      this.#applyStyles(result.styles);
      this.#applyExtended(result.extended);
      if (result.scripts?.length) {
        for (const script of result.scripts) {
          if (!script || this.#injectedScripts.has(script)) {
            continue;
          }
          if (await this.#injectScript(script)) {
            this.#injectedScripts.add(script);
          }
        }
      }
      this.#watch();
    } catch (error) {
      console.error("ZenAdblock content apply failed", error);
    } finally {
      this.#applying = false;
      if (this.#pending && !this.#destroyed) {
        this.#pending = false;
        this.#schedule();
      }
    }
  }

  #collect(doc) {
    const ids = [];
    const classes = [];
    const hrefs = [];
    const seenId = new Set();
    const seenClass = new Set();
    const seenHref = new Set();
    let nodes;
    try {
      nodes = doc.querySelectorAll("[id],[class],[href]");
    } catch {
      return { ids, classes, hrefs };
    }
    const limit = Math.min(nodes.length, SCAN_LIMIT);
    for (let i = 0; i < limit; i++) {
      const el = nodes[i];
      if (el.id && !seenId.has(el.id)) {
        seenId.add(el.id);
        ids.push(el.id);
      }
      if (el.classList) {
        for (const name of el.classList) {
          if (!seenClass.has(name)) {
            seenClass.add(name);
            classes.push(name);
          }
        }
      }
      const href = el.getAttribute?.("href");
      if (href && !seenHref.has(href)) {
        seenHref.add(href);
        hrefs.push(href);
      }
    }
    return { ids, classes, hrefs };
  }

  #applyStyles(css) {
    const doc = this.document;
    if (!css) {
      this.#style?.remove();
      this.#style = null;
      return;
    }
    if (!this.#style || !this.#style.isConnected) {
      this.#style = doc.createElement("style");
      this.#style.id = STYLE_ID;
      (doc.head || doc.documentElement).appendChild(this.#style);
    }
    if (this.#style.textContent !== css) {
      this.#style.textContent = css;
    }
  }

  #applyExtended(extended) {
    if (!extended?.length) {
      return;
    }
    const root = this.document.documentElement;
    if (!root) {
      return;
    }
    for (const rule of extended) {
      if (!rule?.ast) {
        continue;
      }
      let elements = [];
      try {
        elements = lazy.querySelectorAll(root, rule.ast);
      } catch {
        continue;
      }
      for (const element of elements) {
        try {
          if (rule.directive) {
            lazy.handlePseudoDirective(element, rule.directive);
          } else if (rule.attribute) {
            element.setAttribute(rule.attribute, "");
          }
        } catch {
          // One bad procedural filter should not stop the rest.
        }
      }
    }
  }

  async #injectScript(code) {
    const win = this.contentWindow;
    if (!win || !code) {
      return;
    }
    try {
      const script = await compilePageScript(code);
      if (this.#destroyed || this.contentWindow !== win) {
        return false;
      }
      try {
        script.executeInGlobal(win);
      } catch (error) {
        console.error("ZenAdblock scriptlet failed", error);
      }
      return true;
    } catch (error) {
      console.error("ZenAdblock scriptlet failed", error);
      return false;
    }
  }
}
