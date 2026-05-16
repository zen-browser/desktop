/* Astra Browser - New Tab Page Override
 * Runs after browser-delayed-startup-finished
 * so AboutNewTab module is fully initialized.
 */

const ASTRA_NTP_URL =
  "chrome://browser/content/zen-styles/astra-newtab.html";

export const ZenAstraNTP = {
  init() {
    // Wait for browser to be fully ready
    Services.obs.addObserver(this, "browser-delayed-startup-finished");
  },

  observe(subject, topic) {
    if (topic === "browser-delayed-startup-finished") {
      Services.obs.removeObserver(this, "browser-delayed-startup-finished");
      this._overrideNTP();
    }
  },

  _overrideNTP() {
    try {
      const ff = {};
      ChromeUtils.defineESModuleGetters(ff, {
        AboutNewTab: "resource:///modules/AboutNewTab.sys.mjs",
      });
      if (ff.AboutNewTab && ff.AboutNewTab.newTabURL !== ASTRA_NTP_URL) {
        ff.AboutNewTab.newTabURL = ASTRA_NTP_URL;
        console.log("[Astra] NTP override success:", ASTRA_NTP_URL);
      }
    } catch (e) {
      console.error("[Astra] NTP override failed:", e);
    }
  },
};
