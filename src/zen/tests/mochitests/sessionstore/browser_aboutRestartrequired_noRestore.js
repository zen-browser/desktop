"use strict";

function isEntriesMatchingOnURL(A, B) {
  const AUrls = A.entries.map(e => e.url);
  const BUrls = B.entries.map(e => e.url);

  if (AUrls.entries.length !== BUrls.entries.length) {
    return false;
  }

  for (let url of AUrls) {
    if (!BUrls.includes(url)) {
      return false;
    }
  }

  return true;
}

function setState(aTab, aState) {
  // Prepare the tab state.
  let promise = promiseTabRestoring(aTab);
  // setTabState will go through TabState.copyFromCache() from
  // TabState.collect() triggered by saveStateAsyncWhenIdle()
  ss.setTabState(aTab, JSON.stringify(aState));
  return promise;
}

async function cleanup(aBrowser, aTab) {
  // Flush to ensure the parent has all data.
  await TabStateFlusher.flush(aBrowser);

  // Cleanup.
  gBrowser.removeTab(aTab);
}

async function getBrowserTab() {
  // Create a background tab.
  let tab = BrowserTestUtils.addTab(gBrowser, "about:blank");
  let browser = tab.linkedBrowser;
  await BrowserTestUtils.browserLoaded(browser, { wantLoad: "about:blank" });
  return [tab, browser];
}

add_setup(async function () {
  // The tab shouldn't be restored right away.
  Services.prefs.setBoolPref("browser.sessionstore.restore_on_demand", true);
});

add_task(async function only_about_restartrequired() {
  const TAB_STATE = {
    entries: [{ url: "about:restartrequired", triggeringPrincipal_base64 }],
  };

  let [tab, browser] = await getBrowserTab();

  const previousTabState = TabState.collect(
    tab,
    ss.getInternalObjectState(tab)
  );
  is(previousTabState.entries.length, 0, "No entries before");

  await setState(tab, TAB_STATE);

  const collectedTabState = TabState.collect(
    tab,
    ss.getInternalObjectState(tab)
  );
  is(collectedTabState.entries.length, 0, "No entry found");

  await cleanup(browser, tab);
});

add_task(async function one_and_about_restartrequired() {
  const TAB_STATE = {
    entries: [
      { url: "https://www.mozilla.org", triggeringPrincipal_base64 },
      { url: "about:restartrequired", triggeringPrincipal_base64 },
    ],
  };

  let [tab, browser] = await getBrowserTab();

  const previousTabState = TabState.collect(
    tab,
    ss.getInternalObjectState(tab)
  );
  is(previousTabState.entries.length, 0, "No entries before");

  await setState(tab, TAB_STATE);

  const collectedTabState = TabState.collect(
    tab,
    ss.getInternalObjectState(tab)
  );
  is(
    collectedTabState.entries[0].url,
    "https://www.mozilla.org",
    "One entry found"
  );

  await cleanup(browser, tab);
});

add_task(async function about_restartrequired_with_params() {
  const TAB_STATE = {
    entries: [
      {
        url: "about:restartrequired?e=restartrequired&u=about%3Asupport&c=UTF-8&d=%20",
        triggeringPrincipal_base64,
      },
    ],
  };

  let [tab, browser] = await getBrowserTab();

  const previousTabState = TabState.collect(
    tab,
    ss.getInternalObjectState(tab)
  );
  is(previousTabState.entries.length, 0, "No entries before");

  await setState(tab, TAB_STATE);

  const collectedTabState = TabState.collect(
    tab,
    ss.getInternalObjectState(tab)
  );
  is(collectedTabState.entries[0].url, "about:support", "One entry found");

  await cleanup(browser, tab);
});

add_task(async function about_restartrequired_evil() {
  const TAB_STATE = {
    entries: [
      {
        url: "https://www.mozilla.org/?u=http://evil.example.org&someParam=about:restartrequired",
        triggeringPrincipal_base64,
      },
    ],
  };

  let [tab, browser] = await getBrowserTab();

  const previousTabState = TabState.collect(
    tab,
    ss.getInternalObjectState(tab)
  );
  is(previousTabState.entries.length, 0, "No entries before");

  await setState(tab, TAB_STATE);

  const collectedTabState = TabState.collect(
    tab,
    ss.getInternalObjectState(tab)
  );
  is(
    collectedTabState.entries[0].url,
    TAB_STATE.entries[0].url,
    "Original URL found"
  );

  await cleanup(browser, tab);
});
