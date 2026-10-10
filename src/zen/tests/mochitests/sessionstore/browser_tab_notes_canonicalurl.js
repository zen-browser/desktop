/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const { TabNotes } = ChromeUtils.importESModule(
  "moz-src:///browser/components/tabnotes/TabNotes.sys.mjs"
);

const BACKUP_STATE = SessionStore.getBrowserState();

add_setup(async function () {
  await SpecialPowers.pushPrefEnv({
    set: [["browser.tabs.notes.enabled", true]],
  });
});

registerCleanupFunction(async () => {
  await TabNotes.reset();
  await promiseBrowserState(BACKUP_STATE);
});

add_task(async function test_canonicalUrl_respects_privacy_level() {
  await SpecialPowers.pushPrefEnv({
    set: [["browser.sessionstore.privacy_level", 2]],
  });

  const CANONICAL_URL = "https://example.com/canonical-private";

  let tab = BrowserTestUtils.addTab(gBrowser, "https://example.com/");
  await BrowserTestUtils.browserLoaded(tab.linkedBrowser);
  tab.canonicalUrl = CANONICAL_URL;

  let state = JSON.parse(ss.getTabState(tab));
  ok(
    !("canonicalUrl" in state),
    "canonicalUrl should not be saved when privacy level blocks it"
  );

  BrowserTestUtils.removeTab(tab);
  await SpecialPowers.popPrefEnv();
});

add_task(async function test_canonicalUrl_saved_in_closed_tab_state() {
  const CANONICAL_URL = "https://example.com/canonical-undoclose";

  let tab = BrowserTestUtils.addTab(gBrowser, "https://example.com/");
  await BrowserTestUtils.browserLoaded(tab.linkedBrowser);
  tab.canonicalUrl = CANONICAL_URL;

  let tabState = JSON.parse(ss.getTabState(tab));
  is(
    tabState.canonicalUrl,
    CANONICAL_URL,
    "canonicalUrl should be present in tab state before closing"
  );

  await promiseRemoveTabAndSessionState(tab);

  let closedTabData = SessionStore.getClosedTabDataForWindow(window);
  is(
    closedTabData[0].state.canonicalUrl,
    CANONICAL_URL,
    "canonicalUrl should be preserved in closed tab data"
  );

  SessionStore.forgetClosedTab(window, 0);
});

add_task(async function test_canonicalUrl_in_session_state_on_navigation() {
  const CANONICAL_URL = "https://example.com/canonical-nav";

  let tab = BrowserTestUtils.addTab(gBrowser, "https://example.com/");
  await BrowserTestUtils.browserLoaded(tab.linkedBrowser);
  tab.canonicalUrl = CANONICAL_URL;

  let tabState = JSON.parse(ss.getTabState(tab));
  is(
    tabState.canonicalUrl,
    CANONICAL_URL,
    "canonicalUrl should be in session state before navigation"
  );

  BrowserTestUtils.startLoadingURIString(
    tab.linkedBrowser,
    "https://example.org/"
  );
  await BrowserTestUtils.browserLoaded(tab.linkedBrowser);

  tabState = JSON.parse(ss.getTabState(tab));
  isnot(
    tabState.canonicalUrl,
    CANONICAL_URL,
    "canonicalUrl should change after navigation to different URL"
  );

  BrowserTestUtils.removeTab(tab);
});
