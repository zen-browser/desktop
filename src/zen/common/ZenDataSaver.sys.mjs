export class ZenDataSaver {
  static init() {
    const lowBandwidth = Services.prefs.getBoolPref(
      "zen.performance.low-bandwidth-mode.enabled", false
    );

    if (lowBandwidth) {
      // Block autoplay
      Services.prefs.setIntPref("media.autoplay.default", 5);

      // Enable lazy loading
      Services.prefs.setBoolPref(
        "dom.image-lazy-loading.enabled", true
      );

      // Block web fonts
      Services.prefs.setBoolPref(
        "browser.display.use_document_fonts", false
      );

      // Enable disk cache
      Services.prefs.setBoolPref(
        "browser.cache.disk.enable", true
      );
    }
  }
}
