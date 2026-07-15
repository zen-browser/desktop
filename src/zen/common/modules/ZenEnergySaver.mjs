// Astra Energy Saver — battery-aware chrome reduction (single shared manager).
// Modes: auto (default) | on | off via zen.energy-saver.mode
// Attribute astra-energy-saver is synced across all browser windows.

const VALID_MODES = new Set(["auto", "on", "off"]);

export class ZenEnergySaver {
  #battery = null;
  #isEnergySaverActive = false;
  #threshold = 20; // percent
  #reason = "inactive"; // inactive | low-battery | manual | unavailable
  #prefObserver = null;
  #trackedWindows = new WeakSet();
  #windowCount = 0;

  async init() {
    this.#trackWindow(window);

    // New window while already active: apply attribute locally immediately.
    if (this.#isEnergySaverActive) {
      try {
        document.documentElement.setAttribute("astra-energy-saver", "true");
      } catch {
        // ignore
      }
    }

    this.#ensurePrefObserver();

    const mode = this.#readMode();
    if (mode === "off") {
      this.#disableEnergySaver({ silent: true, reason: "inactive" });
      return;
    }
    if (mode === "on") {
      this.#enableEnergySaver({ reason: "manual", silent: true });
    }

    if (this.#battery) {
      this.#onBatteryChange();
      return;
    }
    try {
      if (!navigator.getBattery) {
        this.#reason = mode === "on" ? "manual" : "unavailable";
        return;
      }
      this.#battery = await navigator.getBattery();
      this.#battery.addEventListener("levelchange", () => this.#onBatteryChange());
      this.#battery.addEventListener("chargingchange", () =>
        this.#onBatteryChange()
      );
      this.#onBatteryChange();
    } catch (e) {
      console.warn("[AstraEnergySaver]: Battery API not available", e);
      if (mode !== "on") {
        this.#reason = "unavailable";
      }
    }
  }

  #trackWindow(win) {
    if (!win || this.#trackedWindows.has(win)) {
      return;
    }
    this.#trackedWindows.add(win);
    this.#windowCount += 1;
    win.addEventListener(
      "unload",
      () => {
        this.#onWindowUnload(win);
      },
      { once: true }
    );
  }

  #onWindowUnload(win) {
    try {
      win.document?.documentElement?.removeAttribute("astra-energy-saver");
    } catch {
      // ignore
    }
    this.#windowCount = Math.max(0, this.#windowCount - 1);
    if (this.#windowCount === 0) {
      this.#teardownShared();
    }
  }

  #ensurePrefObserver() {
    if (this.#prefObserver) {
      return;
    }
    this.#prefObserver = () => {
      void this.#applyModeFromPref();
    };
    try {
      Services.prefs.addObserver("zen.energy-saver.mode", this.#prefObserver);
    } catch {
      this.#prefObserver = null;
    }
  }

  #teardownShared() {
    if (this.#prefObserver) {
      try {
        Services.prefs.removeObserver("zen.energy-saver.mode", this.#prefObserver);
      } catch {
        // ignore
      }
      this.#prefObserver = null;
    }
    this.#isEnergySaverActive = false;
    this.#reason = "inactive";
  }

  #forEachBrowserWindow(fn) {
    try {
      const enumerator = Services.wm.getEnumerator("navigator:browser");
      while (enumerator.hasMoreElements()) {
        const win = enumerator.getNext();
        if (!win || win.closed) {
          continue;
        }
        try {
          fn(win);
        } catch {
          // ignore per-window failures
        }
      }
    } catch {
      try {
        fn(window);
      } catch {
        // ignore
      }
    }
  }

  #setAttributeOnAllWindows(active) {
    this.#forEachBrowserWindow(win => {
      const root = win.document?.documentElement;
      if (!root) {
        return;
      }
      if (active) {
        root.setAttribute("astra-energy-saver", "true");
      } else {
        root.removeAttribute("astra-energy-saver");
      }
    });
  }

  #readMode() {
    let mode = "auto";
    try {
      mode = Services.prefs.getStringPref("zen.energy-saver.mode", "auto");
    } catch {
      mode = "auto";
    }
    if (!VALID_MODES.has(mode)) {
      return "auto";
    }
    return mode;
  }

  async #applyModeFromPref() {
    const mode = this.#readMode();
    if (mode === "off") {
      this.#disableEnergySaver({ reason: "inactive" });
      return;
    }
    if (mode === "on") {
      this.#enableEnergySaver({ reason: "manual" });
      return;
    }
    if (this.#battery) {
      this.#onBatteryChange();
    } else {
      this.#disableEnergySaver({ silent: true, reason: "inactive" });
      await this.init();
    }
  }

  #onBatteryChange() {
    if (!this.#battery) {
      return;
    }
    const mode = this.#readMode();
    if (mode === "off") {
      this.#disableEnergySaver({ silent: true, reason: "inactive" });
      return;
    }
    if (mode === "on") {
      this.#enableEnergySaver({ reason: "manual", silent: true });
      return;
    }

    const level = Math.round(this.#battery.level * 100);
    const charging = this.#battery.charging;
    if (!charging && level <= this.#threshold) {
      this.#enableEnergySaver({ reason: "low-battery", level });
    } else {
      this.#disableEnergySaver({ reason: "inactive" });
    }
  }

  #enableEnergySaver({ reason = "manual", level, silent = false } = {}) {
    const wasActive = this.#isEnergySaverActive;
    this.#isEnergySaverActive = true;
    this.#reason = reason;
    this.#setAttributeOnAllWindows(true);
    if (!wasActive && !silent) {
      const toastId =
        reason === "manual"
          ? "astra-energy-saver-enabled-manual"
          : "astra-energy-saver-enabled";
      window.gZenUIManager?.showToast(toastId, { timeout: 4000 });
      if (typeof level === "number") {
        console.log(`[AstraEnergySaver]: Enabled at ${level}%`);
      } else {
        console.log(`[AstraEnergySaver]: Enabled (${reason})`);
      }
    }
  }

  #disableEnergySaver({ reason = "inactive", silent = false } = {}) {
    const wasActive = this.#isEnergySaverActive;
    this.#isEnergySaverActive = false;
    this.#reason = reason;
    this.#setAttributeOnAllWindows(false);
    if (wasActive && !silent) {
      const toastId =
        this.#readMode() === "auto"
          ? "astra-energy-saver-disabled"
          : "astra-energy-saver-disabled-manual";
      window.gZenUIManager?.showToast(toastId, { timeout: 3000 });
      console.log("[AstraEnergySaver]: Disabled");
    }
  }

  get isActive() {
    return this.#isEnergySaverActive;
  }

  get mode() {
    return this.#readMode();
  }

  get status() {
    const mode = this.#readMode();
    if (!this.#battery && mode !== "on") {
      return {
        mode,
        active: this.#isEnergySaverActive,
        reason: this.#isEnergySaverActive ? this.#reason : "unavailable",
        labelId: this.#isEnergySaverActive
          ? "zen-energy-saver-status-manual"
          : "zen-energy-saver-status-unavailable",
      };
    }
    if (this.#isEnergySaverActive) {
      if (this.#reason === "low-battery") {
        return {
          mode,
          active: true,
          reason: "low-battery",
          labelId: "zen-energy-saver-status-low-battery",
        };
      }
      return {
        mode,
        active: true,
        reason: "manual",
        labelId: "zen-energy-saver-status-manual",
      };
    }
    return {
      mode,
      active: false,
      reason: "inactive",
      labelId: "zen-energy-saver-status-inactive",
    };
  }
}

export const gZenEnergySaver = new ZenEnergySaver();
