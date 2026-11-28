/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const kRecommendedPerformancePref =
  "browser.preferences.defaultPerformanceSettings.enabled";
const kHardwareAccelerationPref = "layers.acceleration.disabled";

export class ZenSettingsAdvanced {
  constructor(settings) {
    this.settings = settings;
    this.#initPerformance();
  }

  #initPerformance() {
    const row = document.getElementById("zen-settings-hardware-acceleration");
    let wasRecommended = null;
    this.settings.watchPrefs(
      [kRecommendedPerformancePref, kHardwareAccelerationPref],
      () => {
        const isRecommended = Services.prefs.getBoolPref(
          kRecommendedPerformancePref,
          true
        );
        if (
          isRecommended &&
          wasRecommended === false &&
          !Services.prefs.prefIsLocked(kHardwareAccelerationPref)
        ) {
          Services.prefs.clearUserPref(kHardwareAccelerationPref);
        }
        wasRecommended = isRecommended;
        row.hidden =
          isRecommended &&
          !Services.prefs.prefHasUserValue(kHardwareAccelerationPref);
      }
    );
  }
}
