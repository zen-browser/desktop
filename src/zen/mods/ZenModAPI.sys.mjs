// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { AppConstants } from "resource://gre/modules/AppConstants.sys.mjs";

/**
 * Bumped when something is added; nothing that's there changes meaning.
 */
export const ZEN_MOD_API_VERSION = 1;

const SHORTCUT_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const KEYCODE_RE = /^VK_[A-Z0-9_]+$/;
const MODIFIER_SEPARATOR_RE = /[\s,]+/;
const NON_ID_RE = /[^A-Za-z0-9_-]/g;
const MODIFIERS = new Set(["accel", "alt", "shift", "control", "meta"]);
const ACCEL = AppConstants.platform === "macosx" ? "meta" : "control";

/**
 * @param {string|null} modifiers - A `<key>`'s modifiers, or a list of them
 * @returns {string} The same modifiers in one spelling, "accel" resolved
 */
function normalizeModifiers(modifiers) {
  const list = Array.isArray(modifiers)
    ? modifiers
    : String(modifiers ?? "").split(MODIFIER_SEPARATOR_RE);

  return [
    ...new Set(
      list
        .filter(Boolean)
        .map(modifier => (modifier === "accel" ? ACCEL : modifier))
    ),
  ]
    .sort()
    .join(",");
}

/**
 * What a mod's scripts get from Zen, one per mod and window, as the second
 * argument of `init(window, zen)`.
 *
 * Everything registered through it is undone when the mod stops in that
 * window: turned off, removed, updated or the window closed. A mod that
 * changes the window only through it, and exports `uninit` to say so, goes
 * away without a restart.
 *
 * It's a contract with mod authors: things get added, nothing that's there
 * changes meaning.
 */
export class ZenModAPI {
  #window;
  #mod;
  #onError;
  #ready = null;
  #isDisposed = false;

  /** @type {Set<() => void>} What undoes each registration */
  #cleanups = new Set();

  /**
   * @param {Window} win
   * @param {{id: string, name: string, version: string}} mod
   * @param {(error: *) => void} onError - Reports a failure of the mod's
   * callbacks
   */
  constructor(win, { id, name, version }, onError) {
    this.#window = win;
    this.#mod = Object.freeze({ id, name, version });
    this.#onError = onError;
  }

  /** @returns {number} Which version of this API the mod runs with */
  get version() {
    return ZEN_MOD_API_VERSION;
  }

  /** @returns {{id: string, name: string, version: string}} */
  get mod() {
    return this.#mod;
  }

  /** @returns {Window} The window the mod runs in */
  get window() {
    return this.#window;
  }

  /**
   * @returns {Promise<void>} Resolves once the window and Zen's features in
   * it are set up, for whatever needs tabs, spaces or the toolbars ready
   */
  get ready() {
    // Mods get nothing back: what Zen's promises resolve with isn't API.
    this.#ready ??= Promise.all([
      this.#window.delayedStartupPromise,
      this.#window.gZenWorkspaces?.promiseInitialized,
    ]).then(() => {});

    return this.#ready;
  }

  /** @returns {{id: string, name: string}|null} The space in sight */
  get workspace() {
    const workspace =
      this.#window.gZenWorkspaces?.getActiveWorkspaceFromCache?.();

    return workspace
      ? Object.freeze({ id: workspace.uuid, name: workspace.name })
      : null;
  }

  /** @returns {boolean} Whether compact mode is on */
  get compactMode() {
    return Boolean(this.#window.gZenCompactModeManager?.preference);
  }

  /** @returns {boolean} Whether a split view is in sight */
  get splitView() {
    return (this.#window.gZenViewSplitter?.currentView ?? -1) >= 0;
  }

  /**
   * @param {EventTarget} target
   * @param {string} type
   * @param {Function|object} listener
   * @param {object|boolean} [options]
   * @returns {() => void} Stops listening
   */
  listen(target, type, listener, options) {
    target.addEventListener(type, listener, options);

    return this.#track(() =>
      target.removeEventListener(type, listener, options)
    );
  }

  /**
   * @param {string} name - A preference, or a branch ending in "."
   * @param {(name: string) => void} callback - Gets the preference that
   * changed
   * @returns {() => void} Stops observing
   */
  observePref(name, callback) {
    const guarded = this.#guard(callback);
    const observer = (subject, topic, changed) => guarded(changed);

    Services.prefs.addObserver(name, observer);

    return this.#track(() => Services.prefs.removeObserver(name, observer));
  }

  /**
   * @param {string} topic - An observer service topic
   * @param {(subject: *, data: string) => void} callback
   * @returns {() => void} Stops observing
   */
  observe(topic, callback) {
    const guarded = this.#guard(callback);
    const observer = (subject, observed, data) => guarded(subject, data);

    Services.obs.addObserver(observer, topic);

    return this.#track(() => Services.obs.removeObserver(observer, topic));
  }

  /**
   * @param {Node} target
   * @param {object} options - What `MutationObserver.observe` takes
   * @param {MutationCallback} callback
   * @returns {() => void} Stops observing
   */
  mutations(target, options, callback) {
    const observer = new this.#window.MutationObserver(this.#guard(callback));

    observer.observe(target, options);

    return this.#track(() => observer.disconnect());
  }

  /**
   * Removes a node the mod adds when the mod stops.
   *
   * @param {Node} node
   * @returns {Node} The node, to insert it in the same line
   */
  add(node) {
    if (this.#isDisposed) {
      // The caller inserts it right after this; take it out after that.
      Promise.resolve().then(() => node.remove());
    } else {
      this.#track(() => node.remove());
    }

    return node;
  }

  /**
   * Styles the window while the mod runs, beyond its own sheet: for styles
   * that depend on what the script finds.
   *
   * @param {string} css
   * @returns {() => void} Takes the styles away
   */
  addStyle(css) {
    const utils = this.#window.windowUtils;
    const uri = `data:text/css;charset=utf-8,${encodeURIComponent(String(css))}`;

    utils.loadSheetUsingURIString(uri, utils.AUTHOR_SHEET);

    return this.#track(() =>
      utils.removeSheetUsingURIString(uri, utils.AUTHOR_SHEET)
    );
  }

  /**
   * @param {() => void} callback - Runs when the mod stops in this window
   * @returns {() => void} Runs it now instead
   */
  onCleanup(callback) {
    return this.#track(this.#guard(callback));
  }

  /**
   * Listens to Zen itself, without reaching into its internals:
   *
   * - "workspace-change": `{id, name}` of the space switched to.
   * - "compact-mode": `{enabled}`.
   * - "split-view": `{active}`.
   * - "glance": `{open, tab}`, the tab a glance opened from or closed.
   *
   * @param {"workspace-change"|"compact-mode"|"split-view"|"glance"} event
   * @param {(detail: object) => void} callback
   * @returns {() => void} Stops listening
   */
  on(event, callback) {
    const win = this.#window;
    const guarded = this.#guard(callback);

    switch (event) {
      case "workspace-change": {
        const listener = ({ workspace, onInit }) => {
          if (!onInit) {
            guarded({ id: workspace.uuid, name: workspace.name });
          }
        };

        win.gZenWorkspaces.addChangeListeners(listener);

        return this.#track(() =>
          win.gZenWorkspaces.removeChangeListeners(listener)
        );
      }

      case "compact-mode": {
        return this.listen(win, "ZenCompactMode:Toggled", toggled =>
          guarded({ enabled: Boolean(toggled.detail) })
        );
      }

      case "split-view": {
        return this.#listenToPair(
          ["ZenViewSplitter:SplitViewActivated", { active: true }],
          ["ZenViewSplitter:SplitViewDeactivated", { active: false }],
          guarded
        );
      }

      case "glance": {
        // Glances start from a tab, and the events come from it.
        return this.#listenToPair(
          ["GlanceOpen", { open: true }],
          ["GlanceClose", { open: false }],
          guarded,
          { withTab: true }
        );
      }
    }

    throw new Error(`[ZenMods]: Unknown Zen event: ${event}`);
  }

  /**
   * Adds a keyboard shortcut, which about:keyboard lists under Mods, where
   * the user can change its keys. If Zen, Firefox or another mod already
   * uses them, it's added without keys rather than taking theirs, so the
   * keys the user gave it, or gives it there, still apply.
   *
   * @param {object} shortcut
   * @param {string} shortcut.id - Letters, digits, "_" and "-"
   * @param {string} [shortcut.key] - One character, or
   * @param {string} [shortcut.keycode] - A key without one, like "VK_F5"
   * @param {string[]} [shortcut.modifiers] - Of "accel", "alt", "shift",
   * "control" and "meta"
   * @param {string} [shortcut.label] - What it does, for about:keyboard;
   * the id by default
   * @param {(event: Event) => void} shortcut.command
   * @returns {() => void} Removes the shortcut
   */
  shortcut({ id, key, keycode, modifiers = [], label, command }) {
    const hasKey = typeof key === "string" && key.length === 1;
    const hasKeycode = typeof keycode === "string" && KEYCODE_RE.test(keycode);

    if (!SHORTCUT_ID_RE.test(String(id))) {
      throw new Error(`[ZenMods]: Invalid shortcut id: ${id}`);
    }

    if (hasKey === hasKeycode || typeof command !== "function") {
      throw new Error(
        `[ZenMods]: Shortcut ${id} needs a command and either a key or a keycode.`
      );
    }

    if (
      !Array.isArray(modifiers) ||
      !modifiers.every(modifier => MODIFIERS.has(modifier))
    ) {
      throw new Error(`[ZenMods]: Invalid modifiers for shortcut ${id}.`);
    }

    const doc = this.#window.document;
    const binding = normalizeModifiers(modifiers);
    const taken = [...doc.querySelectorAll("key")].find(
      existing =>
        existing.getAttribute("disabled") !== "true" &&
        normalizeModifiers(existing.getAttribute("modifiers")) === binding &&
        (hasKey
          ? existing.getAttribute("key")?.toLowerCase() === key.toLowerCase()
          : existing.getAttribute("keycode") === keycode)
    );

    if (taken) {
      console.warn(
        `[ZenMods]: Shortcut ${id} of ${this.#mod.name} is taken by ${taken.id || "another key"}; it has no keys until the user gives it some in about:keyboard.`
      );
    }

    // Gecko reads a keyset's keys when the keyset connects, so each shortcut
    // brings its own.
    const elementId = `zen-mod-${this.#mod.id.replace(NON_ID_RE, "")}-${id}`;
    const keyset = doc.createXULElement("keyset");
    const commandElement = doc.createXULElement("command");
    const keyElement = doc.createXULElement("key");

    commandElement.id = `${elementId}-command`;
    commandElement.addEventListener("command", this.#guard(command));
    keyElement.id = elementId;

    if (!taken) {
      keyElement.setAttribute(
        hasKey ? "key" : "keycode",
        hasKey ? key : keycode
      );
      keyElement.setAttribute("modifiers", modifiers.join(","));
    }
    keyElement.setAttribute("command", commandElement.id);
    keyElement.setAttribute(
      "data-zen-mod-shortcut",
      `${this.#mod.name}: ${typeof label === "string" && label ? label : id}`
    );
    keyset.append(commandElement, keyElement);
    // In the body, CustomKeys sees it come and applies what the user chose
    // for it in about:keyboard.
    (doc.body ?? doc.documentElement).append(keyset);

    return this.#track(() => keyset.remove());
  }

  /**
   * Undoes everything the mod registered in this window, the newest first.
   * Zen calls it when the mod stops here.
   */
  dispose() {
    this.#isDisposed = true;

    for (const cleanup of [...this.#cleanups].reverse()) {
      cleanup();
    }
  }

  #listenToPair(
    [firstType, firstDetail],
    [secondType, secondDetail],
    guarded,
    { withTab = false } = {}
  ) {
    const detailOf = (detail, event) =>
      withTab ? { ...detail, tab: event.target } : { ...detail };
    const stopFirst = this.listen(this.#window, firstType, event =>
      guarded(detailOf(firstDetail, event))
    );
    const stopSecond = this.listen(this.#window, secondType, event =>
      guarded(detailOf(secondDetail, event))
    );

    return this.#track(() => {
      stopFirst();
      stopSecond();
    });
  }

  /**
   * @param {() => void} undo
   * @returns {() => void} Runs `undo` once, now or when the mod stops
   */
  #track(undo) {
    let isDone = false;
    const once = () => {
      if (isDone) {
        return;
      }

      isDone = true;
      this.#cleanups.delete(once);

      try {
        undo();
      } catch (error) {
        console.error(
          `[ZenMods]: Cleaning up ${this.#mod.name} failed:`,
          error
        );
      }
    };

    // Something registered after the mod stopped, like after an await, goes
    // right away.
    if (this.#isDisposed) {
      once();
    } else {
      this.#cleanups.add(once);
    }

    return once;
  }

  /**
   * Runs the mod's callbacks so that one that throws reports it on the mod
   * instead of breaking what called it, like a space switch.
   *
   * @param {Function} callback
   * @returns {Function}
   */
  #guard(callback) {
    return (...args) => {
      try {
        return callback(...args);
      } catch (error) {
        console.error(`[ZenMods]: ${this.#mod.name} failed:`, error);
        this.#onError(error);

        return undefined;
      }
    };
  }
}
