// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

const ZEN_MACOS_APP_ICON_VARIANT_PREF = "zen.widget.macos.app-icon-variant";
const ZEN_MACOS_APP_ICON_RESOURCES = {
  alternate: {
    bundlePath: "browser/zen-app-icons/alternate.bundle",
    iconName: "AppIcon",
  },
};

class nsZenAppIcon {
  #initialized = false;

  init() {
    if (this.#initialized || Services.appinfo.OS != "Darwin") {
      return;
    }

    this.#initialized = true;
    Services.prefs.addObserver(ZEN_MACOS_APP_ICON_VARIANT_PREF, this);
    void this.#applyMacOSAppIconVariant();
  }

  uninit() {
    if (!this.#initialized) {
      return;
    }

    this.#initialized = false;
    Services.prefs.removeObserver(ZEN_MACOS_APP_ICON_VARIANT_PREF, this);
  }

  observe(_subject, topic, data) {
    if (topic == "nsPref:changed" && data == ZEN_MACOS_APP_ICON_VARIANT_PREF) {
      void this.#applyMacOSAppIconVariant();
    }
  }

  #applyMacOSAppIconVariant() {
    const variant = Services.prefs.getStringPref(
      ZEN_MACOS_APP_ICON_VARIANT_PREF,
      "default"
    );
    const iconResource = ZEN_MACOS_APP_ICON_RESOURCES[variant];

    Services.zen.setMacOSAppIcon(
      iconResource?.bundlePath ?? "",
      iconResource?.iconName ?? ""
    );
  }
}

export const ZenAppIcon = new nsZenAppIcon();
