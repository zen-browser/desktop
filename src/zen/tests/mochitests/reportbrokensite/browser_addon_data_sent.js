/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

/* Tests to ensure that the right data is sent for
 * private windows and when ETP blocks content.
 */

/* import-globals-from send.js */
/* import-globals-from send_more_info.js */

"use strict";

const { AddonTestUtils } = ChromeUtils.importESModule(
  "resource://testing-common/AddonTestUtils.sys.mjs"
);
AddonTestUtils.initMochitest(this);

Services.scriptloader.loadSubScript(
  getRootDirectory(gTestPath) + "send_more_info.js",
  this
);

add_common_setup();

const TEMP_ID = "testtempaddon@tests.mozilla.org";
const TEMP_NAME = "Temporary Addon";
const TEMP_VERSION = "0.1.0";

const PERM_ID = "testpermaddon@tests.mozilla.org";
const PERM_NAME = "Permanent Addon";
const PERM_VERSION = "0.2.0";

const DISABLED_ID = "testdisabledaddon@tests.mozilla.org";
const DISABLED_NAME = "Disabled Addon";
const DISABLED_VERSION = "0.3.0";

const EXPECTED_ADDONS = [
  { id: PERM_ID, name: PERM_NAME, temporary: false, version: PERM_VERSION },
  { id: TEMP_ID, name: TEMP_NAME, temporary: true, version: TEMP_VERSION },
];

function loadAddon(id, name, version, isTemp = false) {
  return ExtensionTestUtils.loadExtension({
    manifest: {
      browser_specific_settings: { gecko: { id } },
      name,
      version,
    },
    useAddonManager: isTemp ? "temporary" : "permanent",
  });
}

async function installAddons() {
  const temp = await loadAddon(TEMP_ID, TEMP_NAME, TEMP_VERSION, true);
  await temp.startup();

  const perm = await loadAddon(PERM_ID, PERM_NAME, PERM_VERSION);
  await perm.startup();

  const dis = await loadAddon(DISABLED_ID, DISABLED_NAME, DISABLED_VERSION);
  await dis.startup();
  await (await AddonManager.getAddonByID(DISABLED_ID)).disable();

  return async () => {
    await temp.unload();
    await perm.unload();
    await dis.unload();
  };
}

add_task(async function testSendButton() {
  ensureReportBrokenSitePreffedOn();
  ensureReasonOptional();
  const addonCleanup = await installAddons();

  const tab = await openTab(REPORTABLE_PAGE_URL);

  await testSend(tab, AppMenu(), {
    addons: EXPECTED_ADDONS,
  });

  closeTab(tab);
  await addonCleanup();
});

add_task(async function testSendingMoreInfo() {
  ensureReportBrokenSitePreffedOn();
  ensureSendMoreInfoEnabled();
  const addonCleanup = await installAddons();

  const tab = await openTab(REPORTABLE_PAGE_URL);

  await testSendMoreInfo(tab, AppMenu(), {
    addons: EXPECTED_ADDONS,
  });

  closeTab(tab);
  await addonCleanup();
});
