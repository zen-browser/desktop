/* Astra Browser - New Tab Page Override
 *
 * Overrides AboutNewTab.newTabURL so chrome://...astra-newtab.html
 * is served for about:newtab and the new-tab button.
 *
 * Must be called from ZenStartup.delayedStartupFinished() so that
 * AboutNewTab is fully initialized when we mutate newTabURL.
 */

const ASTRA_NTP_URL =
  "chrome://browser/content/zen-styles/astra-newtab.html";

const lazy = {};
ChromeUtils.defineESModuleGetters(lazy, {
  AboutNewTab: "resource:///modules/AboutNewTab.sys.mjs",
});

export const ZenAstraNTP = {
  overrideNTP() {
    try {
      if (lazy.AboutNewTab.newTabURL !== ASTRA_NTP_URL) {
        lazy.AboutNewTab.newTabURL = ASTRA_NTP_URL;
      }
    } catch (e) {
      console.error("[Astra] NTP override failed:", e);
    }
  },
};
