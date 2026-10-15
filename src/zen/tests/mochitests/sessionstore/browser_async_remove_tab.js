"use strict";

async function createTabWithRandomValue(url) {
  let tab = BrowserTestUtils.addTab(gBrowser, url);
  let browser = tab.linkedBrowser;
  await BrowserTestUtils.browserLoaded(browser, { wantLoad: url });

  // Set a random value.
  let r = `rand-${Math.random()}`;
  ss.setCustomTabValue(tab, "foobar", r);

  // Flush to ensure there are no scheduled messages.
  await TabStateFlusher.flush(browser);

  return { tab, r };
}

function isValueInClosedData(rval) {
  return JSON.stringify(ss.getClosedTabDataForWindow(window)).includes(rval);
}

function restoreClosedTabWithValue(rval) {
  let closedTabData = ss.getClosedTabDataForWindow(window);
  let index = closedTabData.findIndex(function (data) {
    return (data.state.extData && data.state.extData.foobar) == rval;
  });

  if (index == -1) {
    throw new Error("no closed tab found for given rval");
  }

  return ss.undoCloseTab(window, index);
}

add_task(async function dont_save_empty_tabs() {
  let { tab, r } = await createTabWithRandomValue("about:blank");

  // Remove the tab before the update arrives.
  let promise = promiseRemoveTabAndSessionState(tab);

  // No tab state worth saving.
  ok(!isValueInClosedData(r), "closed tab not saved");
  await promise;

  // Still no tab state worth saving.
  ok(!isValueInClosedData(r), "closed tab not saved");
});

add_task(async function save_worthy_tabs_remote() {
  let { tab, r } = await createTabWithRandomValue("https://example.com/");
  ok(tab.linkedBrowser.isRemoteBrowser, "browser is remote");

  // Remove the tab before the update arrives.
  let promise = promiseRemoveTabAndSessionState(tab);

  // Tab state deemed worth saving.
  ok(isValueInClosedData(r), "closed tab saved");
  await promise;

  // Tab state still deemed worth saving.
  ok(isValueInClosedData(r), "closed tab saved");
});

add_task(async function save_worthy_tabs_nonremote() {
  let { tab, r } = await createTabWithRandomValue("about:robots");
  ok(!tab.linkedBrowser.isRemoteBrowser, "browser is not remote");

  // Remove the tab before the update arrives.
  let promise = promiseRemoveTabAndSessionState(tab);

  // Tab state deemed worth saving.
  ok(isValueInClosedData(r), "closed tab saved");
  await promise;

  // Tab state still deemed worth saving.
  ok(isValueInClosedData(r), "closed tab saved");
});

add_task(async function save_worthy_tabs_remote_final() {
  let { tab, r } = await createTabWithRandomValue("about:blank");
  let browser = tab.linkedBrowser;
  ok(browser.isRemoteBrowser, "browser is remote");

  // The subtest is racy, see bug 1787024. This is added as a sanity check,
  // but the delay it introduces might also hide the race.
  await TabStateFlusher.flush(browser);
  let state = JSON.parse(ss.getTabState(tab));
  is(state.entries.length, 1, "Should have one SH entry");
  is(state.entries[0].url, "about:blank", "Should be about:blank SH entry");
  ok(
    state.entries[0].transient,
    "Initial about:blank SH entry should be marked for replacement"
  );

  // Replace about:blank with a new remote page.
  let entryReplaced = promiseOnHistoryReplaceEntry(browser);
  browser.loadURI(Services.io.newURI("https://example.com/"), {
    triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal(),
  });
  await entryReplaced;

  // Remotness shouldn't have changed.
  ok(browser.isRemoteBrowser, "browser is still remote");

  // Remove the tab before the update arrives.
  await promiseRemoveTabAndSessionState(tab);

  // Turns out there is a tab state worth saving.
  ok(isValueInClosedData(r), "closed tab saved");
});

add_task(async function save_worthy_tabs_nonremote_final() {
  let { tab, r } = await createTabWithRandomValue("about:blank");
  let browser = tab.linkedBrowser;
  ok(browser.isRemoteBrowser, "browser is remote");

  // Replace about:blank with a non-remote entry.
  BrowserTestUtils.startLoadingURIString(browser, "about:robots");
  await BrowserTestUtils.browserLoaded(browser);
  ok(!browser.isRemoteBrowser, "browser is not remote anymore");

  // Remove the tab before the update arrives.
  await promiseRemoveTabAndSessionState(tab);

  // Turns out there is a tab state worth saving.
  ok(isValueInClosedData(r), "closed tab saved");
});

add_task(async function dont_save_empty_tabs_final() {
  let { tab, r } = await createTabWithRandomValue("https://example.com/");
  let browser = tab.linkedBrowser;
  ok(browser.isRemoteBrowser, "browser is remote");

  // Replace the current page with an about:blank entry.
  let entryReplaced = promiseOnHistoryReplaceEntry(browser);

  // We're doing a cross origin navigation, so we can't reliably use a
  // SpecialPowers task here. Instead we just emulate a location.replace() call.
  browser.loadURI(Services.io.newURI("about:blank"), {
    loadFlags:
      Ci.nsIWebNavigation.LOAD_FLAGS_STOP_CONTENT |
      Ci.nsIWebNavigation.LOAD_FLAGS_REPLACE_HISTORY,
    triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal(),
  });

  await entryReplaced;

  // Remove the tab before the update arrives.
  await promiseRemoveTabAndSessionState(tab);

  // Turns out we don't want to save the tab state.
  ok(!isValueInClosedData(r), "closed tab not saved");
});

add_task(async function undo_worthy_tabs() {
  let { tab, r } = await createTabWithRandomValue("https://example.com/");
  ok(tab.linkedBrowser.isRemoteBrowser, "browser is remote");

  // Remove the tab before the update arrives.
  let promise = promiseRemoveTabAndSessionState(tab);

  // Tab state deemed worth saving.
  ok(isValueInClosedData(r), "closed tab saved");

  // Restore the closed tab before receiving its final message.
  tab = restoreClosedTabWithValue(r);

  // Wait for the final update message.
  await promise;

  // Check we didn't add the tab back to the closed list.
  ok(!isValueInClosedData(r), "tab no longer closed");

  // Cleanup.
  BrowserTestUtils.removeTab(tab);
});

add_task(async function forget_worthy_tabs_remote() {
  let { tab, r } = await createTabWithRandomValue("https://example.com/");
  ok(tab.linkedBrowser.isRemoteBrowser, "browser is remote");

  // Remove the tab before the update arrives.
  let promise = promiseRemoveTabAndSessionState(tab);

  // Tab state deemed worth saving.
  ok(isValueInClosedData(r), "closed tab saved");

  // Forget the closed tab.
  ss.forgetClosedTab(window, 0);

  // Wait for the final update message.
  await promise;

  // Check we didn't add the tab back to the closed list.
  ok(!isValueInClosedData(r), "we forgot about the tab");
});
