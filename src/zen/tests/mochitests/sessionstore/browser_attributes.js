/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

/**
 * This test makes sure that we correctly preserve tab attributes when storing
 * and restoring tabs. It also ensures that we skip special attributes like
 * 'image', 'muted', and 'pending' that need to be
 * handled differently or internally.
 */

const PREF = "browser.sessionstore.restore_on_demand";

add_task(async function test() {
  Services.prefs.setBoolPref(PREF, true);
  registerCleanupFunction(() => Services.prefs.clearUserPref(PREF));

  // Add a new tab with a nice icon.
  let tab = BrowserTestUtils.addTab(gBrowser, "about:robots");
  await promiseBrowserLoaded(tab.linkedBrowser);

  // Because there is debounce logic in FaviconLoader.sys.mjs to reduce the
  // favicon loads, we have to wait some time before checking that icon was
  // stored properly.
  await TestUtils.waitForCondition(
    () => {
      return gBrowser.getIcon(tab) != null;
    },
    "wait for favicon load to finish",
    100,
    5
  );

  // Check that the tab has an 'image' attribute.
  ok(tab.hasAttribute("image"), "tab.image exists");

  tab.toggleMuteAudio();
  // Check that the tab has a 'muted' attribute.
  ok(tab.hasAttribute("muted"), "tab.muted exists");

  // Make sure we do not persist 'image' and 'muted' attributes.
  let { attributes } = JSON.parse(ss.getTabState(tab));
  ok(!("image" in attributes), "'image' attribute not saved");
  ok(!("muted" in attributes), "'muted' attribute not saved");
  ok(!("customizemode" in attributes), "'customizemode' attribute not saved");

  // Test persisting a customizemode attribute.
  {
    let customizationReady = BrowserTestUtils.waitForEvent(
      gNavToolbox,
      "customizationready"
    );
    gCustomizeMode.enter();
    await customizationReady;
  }

  let customizeIcon = gBrowser.getIcon(gBrowser.selectedTab);
  ({ attributes } = JSON.parse(ss.getTabState(gBrowser.selectedTab)));
  ok(!("image" in attributes), "'image' attribute not saved");
  is(attributes.customizemode, "true", "'customizemode' attribute is correct");

  {
    let afterCustomization = BrowserTestUtils.waitForEvent(
      gNavToolbox,
      "aftercustomization"
    );
    gCustomizeMode.exit();
    await afterCustomization;
  }

  // Test restoring a customizemode tab.
  let state = {
    entries: [],
    attributes: { customizemode: "true", nonpersisted: "true" },
  };

  // Customize mode doesn't like being restored on top of a non-blank tab.
  // For the moment, it appears it isn't possible to restore customizemode onto
  // an existing non-blank tab outside of tests, however this may be a latent
  // bug if we ever try to do that in the future.
  let principal = Services.scriptSecurityManager.createNullPrincipal({});
  tab.linkedBrowser.createAboutBlankDocumentViewer(principal, principal);

  // Prepare a pending tab waiting to be restored.
  let promise = promiseTabRestoring(tab);
  ss.setTabState(tab, JSON.stringify(state));
  await promise;

  ok(tab.hasAttribute("pending"), "tab is pending");
  ok(tab.hasAttribute("customizemode"), "tab is in customizemode");
  ok(!tab.hasAttribute("nonpersisted"), "tab has no nonpersisted attribute");
  is(gBrowser.getIcon(tab), customizeIcon, "tab has correct icon");
  ok(!state.attributes.image, "'image' attribute not saved");

  // Let the pending tab load.
  gBrowser.selectedTab = tab;

  // Ensure no 'image' or 'pending' attributes are stored.
  ({ attributes } = JSON.parse(ss.getTabState(tab)));
  ok(!("image" in attributes), "'image' attribute not saved");
  ok(!("pending" in attributes), "'pending' attribute not saved");
  ok(!("nonpersisted" in attributes), "'nonpersisted' attribute not saved");
  is(attributes.customizemode, "true", "'customizemode' attribute is correct");

  // Clean up.
  gBrowser.removeTab(tab);
});
