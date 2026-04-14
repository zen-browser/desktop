/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const ZEN_PREFS = [
  "zen.performance.low-bandwidth-mode.enabled",
  "zen.performance.low-bandwidth-mode.block-autoplay",
  "zen.performance.low-bandwidth-mode.block-images",
  "zen.performance.low-bandwidth-mode.block-fonts",
  "zen.performance.low-bandwidth-mode.lazy-loading",
];

const TARGET_PREFS = [
  "media.autoplay.default",
  "permissions.default.image",
  "browser.display.use_document_fonts",
  "dom.image-lazy-loading.enabled",
  "browser.cache.disk.enable",
];

add_task(async function test_low_bandwidth_mode_applies_and_restores() {
  registerCleanupFunction(() => {
    for (const pref of [...ZEN_PREFS, ...TARGET_PREFS]) {
      Services.prefs.clearUserPref(pref);
    }
  });

  Services.prefs.setIntPref("media.autoplay.default", 1);
  Services.prefs.setIntPref("permissions.default.image", 1);
  Services.prefs.setIntPref("browser.display.use_document_fonts", 1);
  Services.prefs.setBoolPref("dom.image-lazy-loading.enabled", false);
  Services.prefs.setBoolPref("browser.cache.disk.enable", false);

  Services.prefs.setBoolPref("zen.performance.low-bandwidth-mode.enabled", false);
  Services.prefs.setBoolPref("zen.performance.low-bandwidth-mode.block-autoplay", true);
  Services.prefs.setBoolPref("zen.performance.low-bandwidth-mode.block-images", true);
  Services.prefs.setBoolPref("zen.performance.low-bandwidth-mode.block-fonts", true);
  Services.prefs.setBoolPref("zen.performance.low-bandwidth-mode.lazy-loading", true);

  Services.prefs.setBoolPref("zen.performance.low-bandwidth-mode.enabled", true);

  await TestUtils.waitForCondition(
    () =>
      Services.prefs.getIntPref("media.autoplay.default", 1) === 5 &&
      Services.prefs.getIntPref("permissions.default.image", 1) === 2 &&
      Services.prefs.getIntPref("browser.display.use_document_fonts", 1) === 0 &&
      Services.prefs.getBoolPref("dom.image-lazy-loading.enabled", false) &&
      Services.prefs.getBoolPref("browser.cache.disk.enable", false),
    "Low bandwidth mode should apply data saver system prefs."
  );

  Services.prefs.setBoolPref("zen.performance.low-bandwidth-mode.enabled", false);

  await TestUtils.waitForCondition(
    () =>
      Services.prefs.getIntPref("media.autoplay.default", 1) === 1 &&
      Services.prefs.getIntPref("permissions.default.image", 1) === 1 &&
      Services.prefs.getIntPref("browser.display.use_document_fonts", 1) === 1 &&
      !Services.prefs.getBoolPref("dom.image-lazy-loading.enabled", true) &&
      !Services.prefs.getBoolPref("browser.cache.disk.enable", true),
    "Disabling low bandwidth mode should restore previous user pref values."
  );
});
