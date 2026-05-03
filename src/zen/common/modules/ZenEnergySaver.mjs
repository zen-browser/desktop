// Astra Energy Saver - Smart battery management
// Better than Chrome's Energy Saver!

export class ZenEnergySaver {
  #battery = null;
  #isEnergySaverActive = false;
  #threshold = 20; // percent

  async init() {
    try {
      // Re-enable battery API for internal use only
      if (!navigator.getBattery) return;
      this.#battery = await navigator.getBattery();
      this.#battery.addEventListener(
        "levelchange", () => this.#onBatteryChange()
      );
      this.#battery.addEventListener(
        "chargingchange", () => this.#onBatteryChange()
      );
      this.#onBatteryChange();
    } catch(e) {
      console.warn("[AstraEnergySaver]: Battery API not available", e);
    }
  }

  #onBatteryChange() {
    if (!this.#battery) return;
    const level = Math.round(this.#battery.level * 100);
    const charging = this.#battery.charging;

    if (!charging && level <= this.#threshold) {
      this.#enableEnergySaver(level);
    } else {
      this.#disableEnergySaver();
    }
  }

  #enableEnergySaver(level) {
    if (this.#isEnergySaverActive) return;
    this.#isEnergySaverActive = true;

    // Add CSS class to reduce animations
    document.documentElement.setAttribute(
      "astra-energy-saver", "true"
    );

    // Show toast notification
    window.gZenUIManager?.showToast(
      "astra-energy-saver-enabled",
      { timeout: 4000 }
    );

    console.log(`[AstraEnergySaver]: Enabled at ${level}%`);
  }

  #disableEnergySaver() {
    if (!this.#isEnergySaverActive) return;
    this.#isEnergySaverActive = false;

    document.documentElement.removeAttribute("astra-energy-saver");

    window.gZenUIManager?.showToast(
      "astra-energy-saver-disabled",
      { timeout: 3000 }
    );

    console.log("[AstraEnergySaver]: Disabled - charging or battery ok");
  }

  get isActive() {
    return this.#isEnergySaverActive;
  }
}

export const gZenEnergySaver = new ZenEnergySaver();
