const NOTIFY_CLOSED_OBJECTS_CHANGED = "sessionstore-closed-objects-changed";

add_setup(async () => {
  registerCleanupFunction(async () => {
    Services.obs.notifyObservers(null, "browser:purge-session-history");
  });
});

async function check_tab_close_notification(openedTab, expectNotification) {
  let tabUrl = openedTab.linkedBrowser.currentURI.spec;
  let win = openedTab.documentGlobal;
  let initialTabCount = SessionStore.getClosedTabCountForWindow(win);

  let tabClosed = BrowserTestUtils.waitForTabClosing(openedTab);
  let notified = false;
  function topicObserver() {
    notified = true;
  }
  Services.obs.addObserver(topicObserver, NOTIFY_CLOSED_OBJECTS_CHANGED);

  BrowserTestUtils.removeTab(openedTab);
  await tabClosed;
  // SessionStore does a setTimeout(notify, 0) to notifyObservers when it handles TabClose
  // We need to wait long enough to be confident the observer would have been notified
  // if it was going to be.
  let ticks = 0;
  await TestUtils.waitForCondition(() => {
    return ++ticks > 1;
  });

  Services.obs.removeObserver(topicObserver, NOTIFY_CLOSED_OBJECTS_CHANGED);
  if (expectNotification) {
    Assert.ok(
      notified,
      `Expected ${NOTIFY_CLOSED_OBJECTS_CHANGED} when the ${tabUrl} tab closed`
    );
    Assert.equal(
      SessionStore.getClosedTabCountForWindow(win),
      initialTabCount + 1,
      "Expected closed tab count to have incremented"
    );
  } else {
    Assert.ok(
      !notified,
      `Expected no ${NOTIFY_CLOSED_OBJECTS_CHANGED} when the ${tabUrl} tab closed`
    );
    Assert.equal(
      SessionStore.getClosedTabCountForWindow(win),
      initialTabCount,
      "Expected closed tab count to have not changed"
    );
  }
}

add_task(async function test_control_case() {
  let win = window;
  let tabOpenedAndSwitchedTo = BrowserTestUtils.switchTab(
    win.gBrowser,
    () => {}
  );
  let tab = await BrowserTestUtils.openNewForegroundTab(
    win.gBrowser,
    "https://example.com/"
  );
  await tabOpenedAndSwitchedTo;
  await check_tab_close_notification(tab, true);
});

add_task(async function test_about_new_tab() {
  let win = window;
  let tabOpenedAndSwitchedTo = BrowserTestUtils.switchTab(
    win.gBrowser,
    () => {}
  );
  // This opens about:newtab:
  win.BrowserCommands.openTab();
  let tab = await tabOpenedAndSwitchedTo;
  await check_tab_close_notification(tab, false);
});

add_task(async function test_about_home() {
  let win = window;
  let tabOpenedAndSwitchedTo = BrowserTestUtils.switchTab(
    win.gBrowser,
    () => {}
  );
  let tab = await BrowserTestUtils.openNewForegroundTab(
    win.gBrowser,
    "about:home"
  );
  await tabOpenedAndSwitchedTo;
  await check_tab_close_notification(tab, false);
});

add_task(async function test_navigated_about_home() {
  let win = window;
  let tabOpenedAndSwitchedTo = BrowserTestUtils.switchTab(
    win.gBrowser,
    () => {}
  );
  let tab = await BrowserTestUtils.openNewForegroundTab(
    win.gBrowser,
    "https://example.com/"
  );
  await tabOpenedAndSwitchedTo;
  BrowserTestUtils.startLoadingURIString(tab.linkedBrowser, "about:home");
  await BrowserTestUtils.browserLoaded(tab.linkedBrowser);
  // even if we end up on an ignorable URL,
  // if there's meaningful history, we should save this tab
  await check_tab_close_notification(tab, true);
});

add_task(async function test_about_blank() {
  let win = window;
  let tabOpenedAndSwitchedTo = BrowserTestUtils.switchTab(
    win.gBrowser,
    () => {}
  );
  let tab = await BrowserTestUtils.openNewForegroundTab(
    win.gBrowser,
    "about:blank"
  );
  await tabOpenedAndSwitchedTo;
  await check_tab_close_notification(tab, false);
});

add_task(async function test_about_privatebrowsing() {
  let win = window;
  let tabOpenedAndSwitchedTo = BrowserTestUtils.switchTab(
    win.gBrowser,
    () => {}
  );
  let tab = await BrowserTestUtils.openNewForegroundTab(
    win.gBrowser,
    "about:privatebrowsing"
  );
  await tabOpenedAndSwitchedTo;
  await check_tab_close_notification(tab, false);
});
