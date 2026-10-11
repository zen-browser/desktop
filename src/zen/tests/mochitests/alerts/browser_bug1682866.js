const baseURL = getRootDirectory(gTestPath).replace(
  "chrome://mochitests/content",
  "https://example.com"
);

const alertURL = `${baseURL}file_bug1682866.html`;

add_task(async function testAlertForceClosed() {
  let tab = await BrowserTestUtils.openNewForegroundTab(
    gBrowser,
    alertURL,
    true /* waitForLoad */
  );

  // Open a second which is in the same process as tab
  let secondTabIsLoaded = BrowserTestUtils.waitForNewTab(
    gBrowser,
    alertURL,
    true,
    false
  );

  let isSuspendedAfterAlert = await SpecialPowers.spawn(
    tab.linkedBrowser.browsingContext,
    [alertURL],
    url => {
      content.open(url);
      var utils = SpecialPowers.getDOMWindowUtils(content);
      return utils.isInputTaskManagerSuspended;
    }
  );

  await secondTabIsLoaded;

  let secondTab = gBrowser.tabs[2];

  is(
    isSuspendedAfterAlert,
    Services.prefs.getBoolPref("dom.input_events.canSuspendInBCG.enabled"),
    "InputTaskManager should be suspended because alert is opened"
  );

  let alertClosed = BrowserTestUtils.waitForEvent(
    tab.linkedBrowser,
    "DOMModalDialogClosed"
  );

  BrowserTestUtils.startLoadingURIString(tab.linkedBrowser, "about:newtab");

  await BrowserTestUtils.browserLoaded(tab.linkedBrowser);

  await alertClosed;

  gBrowser.removeTab(tab);
  gBrowser.removeTab(secondTab);
});
