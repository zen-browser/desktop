const ZEN_PREFS = Object.freeze({
  ENABLED: "zen.performance.low-bandwidth-mode.enabled",
  BLOCK_IMAGES: "zen.performance.low-bandwidth-mode.block-images",
  BLOCK_AUTOPLAY: "zen.performance.low-bandwidth-mode.block-autoplay",
  BLOCK_FONTS: "zen.performance.low-bandwidth-mode.block-fonts",
  LAZY_LOADING: "zen.performance.low-bandwidth-mode.lazy-loading",
});

const TARGET_PREFS = Object.freeze({
  AUTOPLAY: "media.autoplay.default",
  IMAGE_PERMISSION: "permissions.default.image",
  LAZY_LOADING: "dom.image-lazy-loading.enabled",
  DOCUMENT_FONTS: "browser.display.use_document_fonts",
  DISK_CACHE: "browser.cache.disk.enable",
});

export class ZenDataSaver {
  static #initialized = false;
  static #snapshot = new Map();

  static init() {
    if (this.#initialized) {
      return;
    }
    this.#initialized = true;

    this.#applyCurrentPolicy();

    const onPrefChanged = (_, topic, data) => {
      if (topic !== "nsPref:changed") {
        return;
      }
      if (!Object.values(ZEN_PREFS).includes(data)) {
        return;
      }
      this.#applyCurrentPolicy();
    };

    this._prefObserver = onPrefChanged;
    for (const pref of Object.values(ZEN_PREFS)) {
      Services.prefs.addObserver(pref, onPrefChanged);
    }

    window.addEventListener(
      "unload",
      () => {
        for (const pref of Object.values(ZEN_PREFS)) {
          Services.prefs.removeObserver(pref, onPrefChanged);
        }
      },
      { once: true }
    );
  }

  static #applyCurrentPolicy() {
    const enabled = Services.prefs.getBoolPref(ZEN_PREFS.ENABLED, false);
    if (!enabled) {
      this.#restoreAllManagedPrefs();
      return;
    }

    this.#applyOrRestore(
      TARGET_PREFS.AUTOPLAY,
      Services.prefs.getBoolPref(ZEN_PREFS.BLOCK_AUTOPLAY, true),
      () => Services.prefs.setIntPref(TARGET_PREFS.AUTOPLAY, 5)
    );
    this.#applyOrRestore(
      TARGET_PREFS.IMAGE_PERMISSION,
      Services.prefs.getBoolPref(ZEN_PREFS.BLOCK_IMAGES, false),
      () => Services.prefs.setIntPref(TARGET_PREFS.IMAGE_PERMISSION, 2)
    );
    this.#applyOrRestore(
      TARGET_PREFS.LAZY_LOADING,
      Services.prefs.getBoolPref(ZEN_PREFS.LAZY_LOADING, true),
      () => Services.prefs.setBoolPref(TARGET_PREFS.LAZY_LOADING, true)
    );
    this.#applyOrRestore(
      TARGET_PREFS.DOCUMENT_FONTS,
      Services.prefs.getBoolPref(ZEN_PREFS.BLOCK_FONTS, true),
      () => Services.prefs.setIntPref(TARGET_PREFS.DOCUMENT_FONTS, 0)
    );

    // Keep disk cache enabled while low-bandwidth mode is active.
    this.#applyOrRestore(TARGET_PREFS.DISK_CACHE, true, () =>
      Services.prefs.setBoolPref(TARGET_PREFS.DISK_CACHE, true)
    );
  }

  static #applyOrRestore(prefName, shouldApply, applyFn) {
    if (shouldApply) {
      this.#snapshotPref(prefName);
      applyFn();
      return;
    }
    this.#restoreManagedPref(prefName);
  }

  static #snapshotPref(prefName) {
    if (this.#snapshot.has(prefName)) {
      return;
    }
    const prefType = Services.prefs.getPrefType(prefName);
    const entry = {
      type: prefType,
      hadUserValue: Services.prefs.prefHasUserValue(prefName),
      value: null,
    };
    switch (prefType) {
      case Services.prefs.PREF_BOOL:
        entry.value = Services.prefs.getBoolPref(prefName);
        break;
      case Services.prefs.PREF_INT:
        entry.value = Services.prefs.getIntPref(prefName);
        break;
      case Services.prefs.PREF_STRING:
        entry.value = Services.prefs.getStringPref(prefName);
        break;
      default:
        break;
    }
    this.#snapshot.set(prefName, entry);
  }

  static #restoreManagedPref(prefName) {
    const snapshot = this.#snapshot.get(prefName);
    if (!snapshot) {
      return;
    }
    if (!snapshot.hadUserValue) {
      Services.prefs.clearUserPref(prefName);
      this.#snapshot.delete(prefName);
      return;
    }
    switch (snapshot.type) {
      case Services.prefs.PREF_BOOL:
        Services.prefs.setBoolPref(prefName, snapshot.value);
        break;
      case Services.prefs.PREF_INT:
        Services.prefs.setIntPref(prefName, snapshot.value);
        break;
      case Services.prefs.PREF_STRING:
        Services.prefs.setStringPref(prefName, snapshot.value);
        break;
      default:
        break;
    }
    this.#snapshot.delete(prefName);
  }

  static #restoreAllManagedPrefs() {
    for (const prefName of [...this.#snapshot.keys()]) {
      this.#restoreManagedPref(prefName);
    }
  }
}
