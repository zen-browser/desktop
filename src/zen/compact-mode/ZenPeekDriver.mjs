/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// Relative import: keeps the module loadable outside chrome:// URLs.
import { springFromPrefs } from "./ZenSpring.mjs";

// Mirrors the CSS-computed `--zen-peek` state of the compact sidebar onto a
// SidebarTransition. CSS stays the single source of truth for *whether* the
// sidebar is revealed; this module only decides *how* it moves there.

const KNOWN_STATES = new Set(["revealed", "hidden", "yield"]);

// Attributes that change `--zen-peek` or the hidden offset; keep in sync with
// the selectors in sidebar.inc.css and zen-compact-mode.css.
export const SIDEBAR_ATTRIBUTES = Object.freeze([
  "zen-has-hover",
  "zen-user-show",
  "zen-has-empty-tab",
  "flash-popup",
  "has-popup-menu",
  "movingtab",
  "zen-compact-mode-active",
  "zen-right-side",
]);
export const ROOT_ATTRIBUTES = Object.freeze([
  "zen-compact-mode",
  "customizing",
  "inDOMFullscreen",
  "zen-compact-animating",
  "zen-spring-toggling",
  "zen-renaming-tab",
  "supress-primary-adjustment",
  "zen-right-side",
  "zen-sidebar-expanded",
  "zen-no-padding",
  "zen-single-toolbar",
]);
export const OBSERVED_PREFS = Object.freeze([
  "zen.view.compact.hide-tabbar",
  "zen.view.compact.hide-toolbar",
  "zen.view.use-single-toolbar",
]);

export class PeekDriver {
  #transition;
  #probe;
  #hiddenOffset;
  #subscribe;
  #springs;
  #schedule;
  #warn;
  #mode = "off";
  #target = null;
  #needsJump = false;
  #unsubscribe = null;
  #pending = false;
  #warnedUnknown = false;

  constructor({
    transition,
    probe,
    hiddenOffset,
    subscribe,
    springs,
    schedule,
    warn,
  }) {
    this.#transition = transition;
    this.#probe = probe;
    this.#hiddenOffset = hiddenOffset;
    this.#subscribe = subscribe;
    this.#springs = springs;
    this.#schedule = schedule ?? (cb => queueMicrotask(cb));
    this.#warn = warn ?? ((...args) => console.warn(...args));
  }

  get target() {
    return this.#target;
  }

  get mode() {
    return this.#mode;
  }

  connect() {
    if (this.#unsubscribe) {
      return;
    }
    this.#mode = "init";
    this.#needsJump = true;
    this.#unsubscribe = this.#subscribe(() => this.#queue());
    this.#evaluate();
  }

  disconnect() {
    if (!this.#unsubscribe) {
      return;
    }
    this.#unsubscribe();
    this.#unsubscribe = null;
    this.#pending = false;
    this.#mode = "off";
    this.#target = null;
    this.#transition.release();
  }

  sync({ instant = false } = {}) {
    if (!this.#unsubscribe) {
      return;
    }
    if (instant && this.#mode === "driving") {
      this.#needsJump = true;
    }
    this.#evaluate();
  }

  #queue() {
    if (this.#pending || !this.#unsubscribe) {
      return;
    }
    this.#pending = true;
    this.#schedule(() => {
      if (!this.#pending) {
        return;
      }
      this.#pending = false;
      if (this.#unsubscribe) {
        this.#evaluate();
      }
    });
  }

  #readState() {
    let raw;
    try {
      raw = String(this.#probe() ?? "").trim();
    } catch (e) {
      this.#warn("[ZenPeekDriver] probe failed", e);
      return "yield";
    }
    if (raw === "") {
      return "inactive";
    }
    if (KNOWN_STATES.has(raw)) {
      return raw;
    }
    if (!this.#warnedUnknown) {
      this.#warnedUnknown = true;
      this.#warn(`[ZenPeekDriver] unknown --zen-peek value "${raw}"`);
    }
    return "yield";
  }

  #evaluate() {
    const state = this.#readState();
    if (state === "inactive") {
      if (this.#mode !== "inactive") {
        this.#transition.release();
      }
      this.#mode = "inactive";
      this.#target = null;
      this.#needsJump = true;
      return;
    }
    if (state === "yield") {
      // The yield owner (toggle coordinator) keeps the shared transition's
      // value valid, so leaving yield may animate from the current sample.
      // Keep a pending jump (set by inactive) across yield; init/driving have
      // none.
      if (this.#mode !== "inactive" && this.#mode !== "yield") {
        this.#needsJump = false;
      }
      this.#mode = "yield";
      return;
    }
    const target = state === "revealed" ? 0 : this.#hiddenOffset();
    if (!Number.isFinite(target) || (state === "hidden" && target === 0)) {
      return; // geometry not ready yet; sync() retries
    }
    const wasDriving = this.#mode === "driving";
    this.#mode = "driving";
    if (this.#needsJump) {
      this.#needsJump = false;
      this.#target = target;
      this.#transition.jumpTo(target);
      return;
    }
    if (wasDriving && target === this.#target) {
      return;
    }
    this.#target = target;
    const springs = this.#springs();
    this.#transition.moveTo(target, {
      spring: state === "revealed" ? springs.in : springs.out,
    });
  }

  static forSidebar(el, { transition, isRightSide }) {
    const win = el.documentGlobal;
    const doc = el.ownerDocument;
    return new PeekDriver({
      transition,
      probe: () => win.getComputedStyle(el).getPropertyValue("--zen-peek"),
      hiddenOffset: () => computeHiddenOffset(el, win, isRightSide),
      subscribe: onChange =>
        observeSidebar(el, doc.documentElement, win, onChange),
      springs: () => ({
        in: springFromPrefs(win.Services.prefs, "peek-in"),
        out: springFromPrefs(win.Services.prefs, "peek-out"),
      }),
      schedule: cb => win.queueMicrotask(cb),
    });
  }
}

// Mirrors `--zen-compact-hidden-distance` in sidebar.inc.css:
// calc(100% - var(--zen-compact-float) - 1px), signed by the sidebar side.
export function computeHiddenOffset(el, win, isRightSide) {
  const float =
    parseFloat(
      win.getComputedStyle(el).getPropertyValue("--zen-compact-float")
    ) || 0;
  const width = el.getBoundingClientRect().width;
  const distance = width - float - 1;
  return isRightSide() ? distance : -distance;
}

function observeSidebar(el, root, win, onChange) {
  const mutations = new win.MutationObserver(onChange);
  mutations.observe(el, {
    attributes: true,
    attributeFilter: [...SIDEBAR_ATTRIBUTES],
  });
  mutations.observe(root, {
    attributes: true,
    attributeFilter: [...ROOT_ATTRIBUTES],
  });
  const resize = new win.ResizeObserver(onChange);
  resize.observe(el);
  const prefObserver = { observe: () => onChange() };
  for (const pref of OBSERVED_PREFS) {
    win.Services.prefs.addObserver(pref, prefObserver);
  }
  win.addEventListener("resize", onChange);
  return () => {
    mutations.disconnect();
    resize.disconnect();
    for (const pref of OBSERVED_PREFS) {
      win.Services.prefs.removeObserver(pref, prefObserver);
    }
    win.removeEventListener("resize", onChange);
  };
}
