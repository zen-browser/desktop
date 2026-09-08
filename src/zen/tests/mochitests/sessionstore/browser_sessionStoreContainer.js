/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

add_task(async function () {
  for (let i = 0; i < 3; ++i) {
    let tab = BrowserTestUtils.addTab(gBrowser, "http://example.com/", {
      userContextId: i,
    });
    let browser = tab.linkedBrowser;

    await promiseBrowserLoaded(browser);

    let tab2 = gBrowser.duplicateTab(tab);
    Assert.equal(tab2.getAttribute("usercontextid") || "", i);
    let browser2 = tab2.linkedBrowser;
    await promiseTabRestored(tab2);

    await SpecialPowers.spawn(
      browser2,
      [{ expectedId: i }],
      async function (args) {
        let loadContext = docShell.QueryInterface(Ci.nsILoadContext);
        Assert.equal(
          loadContext.originAttributes.userContextId,
          args.expectedId,
          "The docShell has the correct userContextId"
        );
      }
    );

    BrowserTestUtils.removeTab(tab);
    BrowserTestUtils.removeTab(tab2);
  }
});

add_task(async function () {
  let tab = BrowserTestUtils.addTab(gBrowser, "http://example.com/", {
    userContextId: 1,
  });
  let browser = tab.linkedBrowser;

  await promiseBrowserLoaded(browser);

  gBrowser.selectedTab = tab;

  let tab2 = gBrowser.duplicateTab(tab);
  let browser2 = tab2.linkedBrowser;
  await promiseTabRestored(tab2);

  await SpecialPowers.spawn(
    browser2,
    [{ expectedId: 1 }],
    async function (args) {
      Assert.equal(
        docShell.getOriginAttributes().userContextId,
        args.expectedId,
        "The docShell has the correct userContextId"
      );
    }
  );

  BrowserTestUtils.removeTab(tab);
  BrowserTestUtils.removeTab(tab2);
});

add_task(async function () {
  let tab = BrowserTestUtils.addTab(gBrowser, "http://example.com/", {
    userContextId: 1,
  });
  let browser = tab.linkedBrowser;

  await promiseBrowserLoaded(browser);

  gBrowser.removeTab(tab);

  let tab2 = ss.undoCloseTab(window, 0);
  Assert.equal(tab2.getAttribute("usercontextid"), 1);
  await promiseTabRestored(tab2);
  await SpecialPowers.spawn(
    tab2.linkedBrowser,
    [{ expectedId: 1 }],
    async function (args) {
      Assert.equal(
        docShell.getOriginAttributes().userContextId,
        args.expectedId,
        "The docShell has the correct userContextId"
      );
    }
  );

  BrowserTestUtils.removeTab(tab2);
});

// Opens "uri" in a new tab with the provided userContextId and focuses it.
// Returns the newly opened tab.
async function openTabInUserContext(userContextId) {
  // Open the tab in the correct userContextId.
  let tab = BrowserTestUtils.addTab(gBrowser, "http://example.com", {
    userContextId,
  });

  // Select tab and make sure its browser is focused.
  gBrowser.selectedTab = tab;
  tab.documentGlobal.focus();

  let browser = gBrowser.getBrowserForTab(tab);
  await BrowserTestUtils.browserLoaded(browser);
  return { tab, browser };
}

function waitForNewCookie() {
  return new Promise(resolve => {
    Services.obs.addObserver(function observer(subj, topic) {
      let notification = subj.QueryInterface(Ci.nsICookieNotification);
      if (notification.action == Ci.nsICookieNotification.COOKIE_ADDED) {
        Services.obs.removeObserver(observer, topic);
        resolve();
      }
    }, "session-cookie-changed");
  });
}

add_task(async function test() {
  const USER_CONTEXTS = ["default", "personal", "work"];

  // Make sure userContext is enabled.
  await SpecialPowers.pushPrefEnv({
    set: [["privacy.userContext.enabled", true]],
  });

  Services.cookies.removeAll();

  for (let userContextId of Object.keys(USER_CONTEXTS)) {
    // Load the page in 3 different contexts and set a cookie
    // which should only be visible in that context.
    let cookie = USER_CONTEXTS[userContextId];

    // Open our tab in the given user context.
    let { tab, browser } = await openTabInUserContext(userContextId);

    await Promise.all([
      waitForNewCookie(),
      SpecialPowers.spawn(
        browser,
        [cookie],
        passedCookie => (content.document.cookie = passedCookie)
      ),
    ]);

    // Ensure the tab's session history is up-to-date.
    await TabStateFlusher.flush(browser);

    // Remove the tab.
    gBrowser.removeTab(tab);
  }

  let state = JSON.parse(SessionStore.getBrowserState());
  is(
    state.cookies.length,
    USER_CONTEXTS.length,
    "session restore should have each container's cookie"
  );
});
