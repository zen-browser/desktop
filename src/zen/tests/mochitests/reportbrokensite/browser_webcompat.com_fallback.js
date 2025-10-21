/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

/* Tests that when Report Broken Site is disabled, it will
 * send the user to webcompat.com when clicked and it the
 * relevant tab's report data.
 */

/* import-globals-from send_more_info.js */

"use strict";

Services.scriptloader.loadSubScript(
  getRootDirectory(gTestPath) + "send_more_info.js",
  this
);

add_common_setup();

const VIDEO_URL = `${BASE_URL}/videotest.mp4`;

add_setup(async function () {
  await SpecialPowers.pushPrefEnv({
    set: [["test.wait300msAfterTabSwitch", true]],
  });
});

add_task(async function testWebcompatComFallbacks() {
  ensureReportBrokenSitePreffedOff();

  const tab = await openTab(REPORTABLE_PAGE_URL);

  await testWebcompatComFallback(tab, AppMenu());

  await changeTab(tab, REPORTABLE_PAGE_URL2);
  await testWebcompatComFallback(tab, ProtectionsPanel());

  // also load a video to ensure system codec
  // information is loaded and properly sent
  const tab2 = await openTab(VIDEO_URL);
  await testWebcompatComFallback(tab2, HelpMenu());
  closeTab(tab2);

  closeTab(tab);
});
