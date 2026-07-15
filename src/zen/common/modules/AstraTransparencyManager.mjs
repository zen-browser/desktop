// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { AppConstants } from "resource://gre/modules/AppConstants.sys.mjs";

const PREF_ENABLED = "astra.theme.transparent.enabled";
const PREF_MODE = "astra.theme.transparent.mode";
const PREF_V2_OWNED = "astra.theme.transparent.v2-native-owned";
const PREF_MICA = "widget.windows.mica";
const PREF_MICA_POPUPS = "widget.windows.mica.popups";
const PREF_MICA_BACKDROP = "widget.windows.mica.toplevel-backdrop";

const ATTR_DESIRED = "astra-transparent-desired";
const ATTR_REQUESTED = "astra-transparent-requested-mode";
const ATTR_EFFECTIVE = "astra-transparent-effective-mode";
const ATTR_FALLBACK = "astra-transparent-fallback-reason";
const ATTR_NATIVE_REQ = "astra-transparent-native-requested";
/** @deprecated Compatibility alias — follows desiredEnabled, not effective mode. */
const ATTR_LEGACY_MODE = "astra-transparent-mode";
const LEGACY_CLASS = "astra-transparent-enabled";

const REQUESTED_MODES = Object.freeze([
  "auto",
  "acrylic",
  "mica",
  "mica-alt",
  "astra-glass",
]);

const FALLBACK_REASONS = Object.freeze([
  "none",
  "disabled",
  "unsupported-platform",
  "unsupported-windows-build",
  "native-pref-unavailable",
  "native-application-failed",
  "os-effects-disabled",
  "theme-conflict",
  "opaque-surface-conflict",
  "energy-saver",
  "high-contrast",
  "reduced-transparency",
  "window-recreated",
  "unknown-native-failure",
]);

const BACKDROP = Object.freeze({
  mica: 1,
  acrylic: 2,
  "mica-alt": 3,
});

const EFFECTIVE_FOR_NATIVE = Object.freeze({
  acrylic: "native-acrylic",
  mica: "native-mica",
  "mica-alt": "native-mica-alt",
});

/**
 * Policy B — native best-effort (documented):
 * JavaScript cannot pixel-prove DWM Acrylic/Mica. matchMedia("(-moz-windows-mica)")
 * only reflects pref + Win11 22H2 gate, not visible backdrop pixels.
 * Therefore nativeApplied is never "true" from MQ alone; it is "best-effort" when
 * native prefs are requested and retained. Chrome always keeps an Astra material
 * floor so DWM decline cannot leave ordinary opaque theme while desired is on.
 */

/**
 * Process-wide native pref coordinator.
 * Ownership: Astra persists user values for mica/popups/backdrop while it owns
 * Transparent Mode. OFF writes mica=false and popups=0 (clears stale ON values).
 * Stores no window/DOM references.
 */
const NativeCoordinator = (() => {
  let micaState = false;
  let backdropState = 2;
  let popupsState = 0;
  let ownershipMigrated = false;

  function syncPrefs(mica, backdrop, popups) {
    if (AppConstants.platform !== "win") {
      return false;
    }
    let changed = false;
    try {
      if (Services.prefs.getBoolPref(PREF_MICA, false) !== mica) {
        Services.prefs.setBoolPref(PREF_MICA, mica);
        changed = true;
      }
      if (Services.prefs.getIntPref(PREF_MICA_BACKDROP, 0) !== backdrop) {
        Services.prefs.setIntPref(PREF_MICA_BACKDROP, backdrop);
        changed = true;
      }
      if (Services.prefs.getIntPref(PREF_MICA_POPUPS, 0) !== popups) {
        Services.prefs.setIntPref(PREF_MICA_POPUPS, popups);
        changed = true;
      }
    } catch (e) {
      console.error("[AstraTransparency] native pref write failed", e);
    }
    return changed;
  }

  return {
    snapshot() {
      return {
        mica: micaState,
        backdrop: backdropState,
        popups: popupsState,
      };
    },

    /**
     * One-shot: normalize stale always-on mica from pre-V2 profiles.
     * Does not touch astra.theme.transparent.enabled.
     */
    ensureOwnershipMigrated(desiredEnabled) {
      if (ownershipMigrated) {
        return;
      }
      ownershipMigrated = true;
      try {
        if (Services.prefs.getBoolPref(PREF_V2_OWNED, false)) {
          return;
        }
        if (!desiredEnabled) {
          syncPrefs(false, 2, 0);
          micaState = false;
          backdropState = 2;
          popupsState = 0;
        }
        Services.prefs.setBoolPref(PREF_V2_OWNED, true);
      } catch (e) {
        console.warn("[AstraTransparency] native ownership migration failed", e);
      }
    },

    /**
     * @param {{ mica: boolean, backdrop?: number, popups?: number }} req
     * @returns {boolean}
     */
    apply(req) {
      const mica = !!req.mica;
      const backdrop = req.backdrop ?? backdropState;
      const popups = req.popups ?? (mica ? 1 : 0);
      micaState = mica;
      backdropState = backdrop;
      popupsState = popups;
      return syncPrefs(mica, backdrop, popups);
    },

    clear() {
      return this.apply({ mica: false, backdrop: 2, popups: 0 });
    },
  };
})();

/**
 * Per-window Transparent Mode V2 manager.
 */
class AstraTransparencyManager {
  #prefObserver = null;
  #initialized = false;
  #destroyed = false;
  #reapplyQueued = false;
  #suppressPrefObserver = false;
  #windowGeneration = 0;
  #attemptedNativeModes = new Set();
  #lastLoggedKey = "";
  #lastApplyStage = "construct";
  #energySaverObserver = null;
  #micaMedia = null;
  #contrastMedia = null;
  #reducedTransparencyMedia = null;
  #state = {
    desiredEnabled: false,
    requestedMode: "auto",
    effectiveMode: "opaque",
    nativeSupported: false,
    nativeRequested: false,
    nativeApplied: false,
    fallbackReason: "disabled",
    restartRequired: false,
  };

  constructor() {
    this.#bumpGeneration("construct");
    this.#apply({ stage: "construct" });

    document.addEventListener(
      "MozBeforeInitialXULLayout",
      () => this.init(),
      { once: true }
    );
  }

  init() {
    if (this.#destroyed) {
      return;
    }
    if (this.#initialized) {
      this.#queueReapply("init-reentry");
      return;
    }
    this.#initialized = true;

    this.#prefObserver = () => {
      if (this.#suppressPrefObserver || this.#destroyed) {
        return;
      }
      this.#queueReapply("pref-changed");
    };
    Services.prefs.addObserver(PREF_ENABLED, this.#prefObserver);
    Services.prefs.addObserver(PREF_MODE, this.#prefObserver);

    window.addEventListener("unload", () => this.uninit(), { once: true });
    window.addEventListener("sizemodechange", this.#onLifecycle, {
      passive: true,
    });
    // activate: reapply only — does not reset attempt budget
    window.addEventListener("activate", this.#onLifecycle, { passive: true });
    document.addEventListener("fullscreenchange", this.#onLifecycle, {
      passive: true,
    });
    document.addEventListener("MozDOMFullscreen:Entered", this.#onLifecycle, {
      passive: true,
    });
    document.addEventListener("MozDOMFullscreen:Exited", this.#onLifecycle, {
      passive: true,
    });

    try {
      Services.obs.addObserver(
        this.#onDelayedStartup,
        "browser-delayed-startup-finished"
      );
    } catch (e) {
      /* already past */
    }

    try {
      Services.obs.addObserver(
        this.#onThemeUpdate,
        "lightweight-theme-styling-update"
      );
    } catch (e) {
      /* optional */
    }

    this.#energySaverObserver = new MutationObserver(() =>
      this.#queueReapply("energy-saver")
    );
    if (document.documentElement) {
      this.#energySaverObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["astra-energy-saver"],
      });
    }

    try {
      this.#micaMedia = window.matchMedia("(-moz-windows-mica)");
      this.#micaMedia.addEventListener?.("change", this.#onLifecycle);
    } catch (e) {
      /* ignore */
    }
    try {
      this.#contrastMedia = window.matchMedia("(prefers-contrast)");
      this.#contrastMedia.addEventListener?.("change", this.#onLifecycle);
    } catch (e) {
      /* ignore */
    }
    try {
      this.#reducedTransparencyMedia = window.matchMedia(
        "(prefers-reduced-transparency)"
      );
      this.#reducedTransparencyMedia.addEventListener?.(
        "change",
        this.#onLifecycle
      );
    } catch (e) {
      /* ignore */
    }

    this.#apply({ stage: "init" });
  }

  #onLifecycle = () => this.#queueReapply("lifecycle");

  #onDelayedStartup = (subject, topic) => {
    if (topic !== "browser-delayed-startup-finished" || subject !== window) {
      return;
    }
    try {
      Services.obs.removeObserver(
        this.#onDelayedStartup,
        "browser-delayed-startup-finished"
      );
    } catch (e) {
      /* ignore */
    }
    // Reapply without resetting attempt budget (avoids Acrylic↔Mica flicker).
    this.#queueReapply("delayed-startup");
  };

  #onThemeUpdate = () => this.#queueReapply("theme-update");

  reapply() {
    this.#apply({ stage: "reapply" });
  }

  onStartupReady() {
    // Settled startup — health check path, no generation bump.
    this.#apply({ stage: "startup-ready" });
  }

  uninit() {
    this.#destroyed = true;
    this.#reapplyQueued = false;
    if (this.#prefObserver) {
      try {
        Services.prefs.removeObserver(PREF_ENABLED, this.#prefObserver);
      } catch (e) {
        /* ignore */
      }
      try {
        Services.prefs.removeObserver(PREF_MODE, this.#prefObserver);
      } catch (e) {
        /* ignore */
      }
      this.#prefObserver = null;
    }
    try {
      Services.obs.removeObserver(
        this.#onDelayedStartup,
        "browser-delayed-startup-finished"
      );
    } catch (e) {
      /* ignore */
    }
    try {
      Services.obs.removeObserver(
        this.#onThemeUpdate,
        "lightweight-theme-styling-update"
      );
    } catch (e) {
      /* ignore */
    }
    window.removeEventListener("sizemodechange", this.#onLifecycle);
    window.removeEventListener("activate", this.#onLifecycle);
    document.removeEventListener("fullscreenchange", this.#onLifecycle);
    document.removeEventListener("MozDOMFullscreen:Entered", this.#onLifecycle);
    document.removeEventListener("MozDOMFullscreen:Exited", this.#onLifecycle);
    this.#micaMedia?.removeEventListener?.("change", this.#onLifecycle);
    this.#contrastMedia?.removeEventListener?.("change", this.#onLifecycle);
    this.#reducedTransparencyMedia?.removeEventListener?.(
      "change",
      this.#onLifecycle
    );
    this.#energySaverObserver?.disconnect();
    this.#energySaverObserver = null;
    this.#initialized = false;
  }

  get enabled() {
    return Services.prefs.getBoolPref(PREF_ENABLED, true);
  }

  get requestedMode() {
    const raw = Services.prefs.getStringPref(PREF_MODE, "auto");
    return REQUESTED_MODES.includes(raw) ? raw : "auto";
  }

  setEnabled(value) {
    const next = !!value;
    if (this.enabled === next) {
      this.#apply({ stage: "setEnabled-noop" });
      return;
    }
    this.#suppressPrefObserver = true;
    try {
      Services.prefs.setBoolPref(PREF_ENABLED, next);
    } finally {
      this.#suppressPrefObserver = false;
    }
    this.#apply({ stage: "setEnabled" });
    this.syncThemePickerButton();
  }

  setRequestedMode(mode) {
    const next = REQUESTED_MODES.includes(mode) ? mode : "auto";
    if (this.requestedMode === next) {
      this.#apply({ stage: "setMode-noop" });
      return;
    }
    this.#bumpGeneration("mode-change");
    this.#suppressPrefObserver = true;
    try {
      Services.prefs.setStringPref(PREF_MODE, next);
    } finally {
      this.#suppressPrefObserver = false;
    }
    this.#apply({ stage: "setMode" });
    this.syncThemePickerButton();
  }

  toggleFromUI() {
    this.setEnabled(!this.enabled);
  }

  isEnabled() {
    return this.enabled;
  }

  getDiagnostics() {
    const root = document.documentElement;
    const sizemode = root?.getAttribute("sizemode") || "unknown";
    return Object.freeze({
      desiredEnabled: this.#state.desiredEnabled,
      requestedMode: this.#state.requestedMode,
      effectiveMode: this.#state.effectiveMode,
      nativeSupported: this.#state.nativeSupported,
      nativeRequested: this.#state.nativeRequested,
      nativeApplied:
        this.#state.nativeApplied === "best-effort" ? "best-effort" : false,
      fallbackReason: this.#state.fallbackReason,
      restartRequired: false,
      windowState: sizemode,
      windowGeneration: this.#windowGeneration,
      lastApplyStage: this.#lastApplyStage,
    });
  }

  #bumpGeneration(reason) {
    this.#windowGeneration += 1;
    this.#attemptedNativeModes = new Set();
    this.#lastApplyStage = reason;
  }

  #queueReapply(stage) {
    if (this.#destroyed || this.#reapplyQueued) {
      return;
    }
    this.#reapplyQueued = true;
    const run = () => {
      this.#reapplyQueued = false;
      if (this.#destroyed || window.closed) {
        return;
      }
      try {
        this.#apply({ stage });
      } catch (e) {
        console.error("[AstraTransparency] reapply failed", e);
      }
    };
    if (typeof queueMicrotask === "function") {
      queueMicrotask(run);
    } else {
      Promise.resolve().then(run);
    }
  }

  #platformSupportsNative() {
    return AppConstants.platform === "win";
  }

  #match(query) {
    try {
      return !!window.matchMedia?.(query)?.matches;
    } catch (e) {
      return false;
    }
  }

  #isHighContrast() {
    return (
      this.#match("(prefers-contrast)") || this.#match("(-moz-high-contrast)")
    );
  }

  #isReducedTransparency() {
    return this.#match("(prefers-reduced-transparency)");
  }

  #isEnergySaver() {
    return (
      document.documentElement?.getAttribute("astra-energy-saver") === "true"
    );
  }

  #micaMediaActive() {
    // Capability hint only — never proof of visible DWM glass.
    return this.#match("(-moz-windows-mica)");
  }

  /**
   * @returns {Array<"acrylic"|"mica"|"mica-alt">}
   */
  #nativeCandidates(requestedMode) {
    switch (requestedMode) {
      case "acrylic":
        return ["acrylic"];
      case "mica":
        return ["mica"];
      case "mica-alt":
        return ["mica-alt"];
      case "auto":
        return ["acrylic", "mica"];
      default:
        return [];
    }
  }

  #commitGlass(root, partial) {
    this.#writeState(partial);
    this.#applyRootAttributes(root);
    this.#logTransition(
      partial.effectiveMode === "opaque" ? "disabled" : partial.effectiveMode,
      partial.fallbackReason === "none" ? "" : partial.fallbackReason
    );
    this.syncThemePickerButton();
  }

  #apply({ stage }) {
    if (this.#destroyed || window.closed) {
      return;
    }
    this.#lastApplyStage = stage;
    const root = document.documentElement;
    if (!root) {
      return;
    }

    root.classList.remove(LEGACY_CLASS);

    const desiredEnabled = this.enabled;
    const requestedMode = this.requestedMode;
    const nativeSupported = this.#platformSupportsNative();

    NativeCoordinator.ensureOwnershipMigrated(desiredEnabled);

    if (!desiredEnabled) {
      NativeCoordinator.clear();
      this.#commitGlass(root, {
        desiredEnabled,
        requestedMode,
        effectiveMode: "opaque",
        nativeSupported,
        nativeRequested: false,
        nativeApplied: false,
        fallbackReason: "disabled",
      });
      return;
    }

    // Startup policy: deterministic Astra Glass shell first on construct so
    // chrome never paints as ordinary opaque while native request settles.
    if (stage === "construct") {
      this.#commitGlass(root, {
        desiredEnabled,
        requestedMode,
        effectiveMode: "astra-glass",
        nativeSupported,
        nativeRequested: false,
        nativeApplied: false,
        fallbackReason: "none",
      });
      // Continue into native request below in the same turn after shell is on.
    }

    if (this.#isHighContrast()) {
      NativeCoordinator.clear();
      this.#commitGlass(root, {
        desiredEnabled,
        requestedMode,
        effectiveMode: "astra-glass",
        nativeSupported,
        nativeRequested: false,
        nativeApplied: false,
        fallbackReason: "high-contrast",
      });
      return;
    }

    if (this.#isReducedTransparency()) {
      NativeCoordinator.clear();
      this.#commitGlass(root, {
        desiredEnabled,
        requestedMode,
        effectiveMode: "astra-glass",
        nativeSupported,
        nativeRequested: false,
        nativeApplied: false,
        fallbackReason: "reduced-transparency",
      });
      return;
    }

    if (requestedMode === "astra-glass") {
      NativeCoordinator.clear();
      this.#commitGlass(root, {
        desiredEnabled,
        requestedMode,
        effectiveMode: "astra-glass",
        nativeSupported,
        nativeRequested: false,
        nativeApplied: false,
        fallbackReason: "none",
      });
      return;
    }

    if (!nativeSupported) {
      NativeCoordinator.clear();
      this.#commitGlass(root, {
        desiredEnabled,
        requestedMode,
        effectiveMode: "astra-glass",
        nativeSupported: false,
        nativeRequested: false,
        nativeApplied: false,
        fallbackReason: "unsupported-platform",
      });
      return;
    }

    const candidates = this.#nativeCandidates(requestedMode);
    let selectedNative = null;
    let failReason = "native-application-failed";
    let nativeRequested = false;

    for (const candidate of candidates) {
      if (this.#attemptedNativeModes.has(candidate)) {
        continue;
      }
      this.#attemptedNativeModes.add(candidate);

      const backdrop = BACKDROP[candidate];
      if (!backdrop || backdrop < 1 || backdrop > 3) {
        continue;
      }

      this.#logTransition(`native-${candidate}-requested`);
      NativeCoordinator.apply({
        mica: true,
        backdrop,
        popups: 1,
      });
      nativeRequested = true;

      const prefsOk =
        Services.prefs.getBoolPref(PREF_MICA, false) === true &&
        Services.prefs.getIntPref(PREF_MICA_BACKDROP, 0) === backdrop;

      if (!prefsOk) {
        failReason = "native-pref-unavailable";
        continue;
      }

      // Prefs retained → accept this candidate as best-effort native.
      // MQ is a capability hint only; never nativeApplied=true from MQ alone.
      // Concrete failure to try next candidate: prefs failed (above), or after
      // layout settle the platform still reports no mica capability.
      const settled =
        stage === "delayed-startup" ||
        stage === "startup-ready" ||
        stage === "lifecycle" ||
        stage === "theme-update" ||
        stage === "energy-saver" ||
        stage === "pref-changed" ||
        stage === "setEnabled" ||
        stage === "setMode" ||
        stage === "reapply" ||
        stage === "init" ||
        stage === "init-reentry";

      if (settled && !this.#micaMediaActive()) {
        // Capability gate failed after prefs applied — try next / Glass.
        failReason = "unsupported-windows-build";
        continue;
      }

      selectedNative = candidate;
      break;
    }

    if (selectedNative) {
      this.#commitGlass(root, {
        desiredEnabled,
        requestedMode,
        effectiveMode: EFFECTIVE_FOR_NATIVE[selectedNative],
        nativeSupported: true,
        nativeRequested: true,
        nativeApplied: "best-effort",
        fallbackReason: "none",
      });
      if (
        stage === "startup-ready" ||
        stage === "delayed-startup" ||
        stage === "lifecycle"
      ) {
        this.#runHealthCheck();
      }
      return;
    }

    NativeCoordinator.clear();
    let fallbackReason = failReason;
    if (
      fallbackReason === "unsupported-windows-build" &&
      this.#isReducedTransparency()
    ) {
      fallbackReason = "os-effects-disabled";
    }
    this.#commitGlass(root, {
      desiredEnabled,
      requestedMode,
      effectiveMode: "astra-glass",
      nativeSupported,
      nativeRequested,
      nativeApplied: false,
      fallbackReason,
    });
  }

  #writeState(partial) {
    let nativeApplied = partial.nativeApplied;
    // Policy B: only false | "best-effort" are legal stored values.
    if (nativeApplied !== "best-effort") {
      nativeApplied = false;
    }
    this.#state = {
      desiredEnabled: !!partial.desiredEnabled,
      requestedMode: partial.requestedMode,
      effectiveMode: partial.effectiveMode,
      nativeSupported: !!partial.nativeSupported,
      nativeRequested: !!partial.nativeRequested,
      nativeApplied,
      fallbackReason: FALLBACK_REASONS.includes(partial.fallbackReason)
        ? partial.fallbackReason
        : "unknown-native-failure",
      restartRequired: false,
    };
  }

  #applyRootAttributes(root) {
    const s = this.#state;
    if (!s.desiredEnabled) {
      root.setAttribute(ATTR_DESIRED, "false");
      root.setAttribute(ATTR_REQUESTED, s.requestedMode);
      root.setAttribute(ATTR_EFFECTIVE, "opaque");
      root.setAttribute(ATTR_FALLBACK, "disabled");
      root.setAttribute(ATTR_NATIVE_REQ, "false");
      root.removeAttribute(ATTR_LEGACY_MODE);
      return;
    }
    root.setAttribute(ATTR_DESIRED, "true");
    root.setAttribute(ATTR_REQUESTED, s.requestedMode);
    root.setAttribute(ATTR_EFFECTIVE, s.effectiveMode);
    root.setAttribute(ATTR_FALLBACK, s.fallbackReason);
    root.setAttribute(ATTR_NATIVE_REQ, s.nativeRequested ? "true" : "false");
    root.setAttribute(ATTR_LEGACY_MODE, "true");
  }

  #runHealthCheck() {
    const s = this.#state;
    if (!s.desiredEnabled || !s.effectiveMode.startsWith("native-")) {
      return;
    }

    const backdrop = Services.prefs.getIntPref(PREF_MICA_BACKDROP, 0);
    const micaOn = Services.prefs.getBoolPref(PREF_MICA, false);
    if (!micaOn || backdrop < 1 || backdrop > 3) {
      this.#fallbackFromHealth("native-pref-unavailable");
      return;
    }

    const root = document.documentElement;
    if (root?.getAttribute(ATTR_EFFECTIVE) !== s.effectiveMode) {
      this.#fallbackFromHealth("opaque-surface-conflict");
      return;
    }

    if (this.#isHighContrast()) {
      this.#fallbackFromHealth("high-contrast");
      return;
    }
    if (this.#isReducedTransparency()) {
      this.#fallbackFromHealth("reduced-transparency");
      return;
    }

    // Capability gate lost → Astra Glass (material floor already present in CSS
    // for native modes; switch effective mode for honest status).
    if (!this.#micaMediaActive()) {
      this.#fallbackFromHealth("native-application-failed");
    }
  }

  #fallbackFromHealth(reason) {
    const root = document.documentElement;
    if (!root || this.#destroyed || this.#state.effectiveMode === "astra-glass") {
      return;
    }
    NativeCoordinator.clear();
    this.#commitGlass(root, {
      ...this.#state,
      effectiveMode: "astra-glass",
      nativeRequested: false,
      nativeApplied: false,
      fallbackReason: reason,
    });
  }

  #logTransition(kind, reason = "") {
    const key = `${kind}|${reason}|${this.#state.effectiveMode}`;
    if (key === this.#lastLoggedKey) {
      return;
    }
    this.#lastLoggedKey = key;

    switch (kind) {
      case "disabled":
      case "opaque":
        console.info("[AstraTransparency] Transparent Mode disabled");
        break;
      case "native-acrylic-requested":
        console.info("[AstraTransparency] native Acrylic requested");
        break;
      case "native-mica-requested":
        console.info("[AstraTransparency] native Mica requested");
        break;
      case "native-mica-alt-requested":
        console.info("[AstraTransparency] native Mica Alt requested");
        break;
      case "astra-glass":
        console.info(
          `[AstraTransparency] native backdrop unavailable; Astra Glass active` +
            (reason ? ` (${reason})` : "")
        );
        break;
      case "native-acrylic":
      case "native-mica":
      case "native-mica-alt":
        if (
          this.#lastApplyStage === "lifecycle" ||
          this.#lastApplyStage === "delayed-startup" ||
          this.#lastApplyStage === "startup-ready"
        ) {
          console.info(
            "[AstraTransparency] window lifecycle reapply completed"
          );
        }
        break;
      default:
        if (reason && kind.includes("health")) {
          console.info(
            `[AstraTransparency] opaque chrome conflict recovered (${reason})`
          );
        }
        break;
    }
  }

  syncThemePickerButton() {
    const btn = document.getElementById("zen-theme-picker-transparent-btn");
    if (!btn) {
      return;
    }
    const on = this.#state.desiredEnabled;
    const effective = this.#state.effectiveMode;
    let l10nId = "astra-theme-transparent-off";
    if (on) {
      switch (effective) {
        case "native-acrylic":
          // Honest: request only — not confirmed DWM pixels.
          l10nId = "astra-theme-transparent-acrylic-requested";
          break;
        case "native-mica":
          l10nId = "astra-theme-transparent-mica-requested";
          break;
        case "native-mica-alt":
          l10nId = "astra-theme-transparent-mica-alt-requested";
          break;
        case "astra-glass":
          l10nId = "astra-theme-transparent-astra-glass";
          break;
        default:
          l10nId = "astra-theme-transparent-on";
          break;
      }
    }
    if (document.l10n) {
      document.l10n.setAttributes(btn, l10nId);
    } else {
      btn.setAttribute("label", on ? "ON" : "Off");
    }
    btn.setAttribute("astra-transparent-active", on ? "true" : "false");
  }
}

window.gAstraTransparency = new AstraTransparencyManager();

Object.defineProperty(window, "gAstraTransparencyDiagnostics", {
  configurable: true,
  enumerable: true,
  get() {
    return window.gAstraTransparency?.getDiagnostics?.() ?? null;
  },
});
