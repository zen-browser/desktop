/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * Test that we don't do unnecessary tab label changes while restoring a tab.
 */

add_task(async function () {
  await SpecialPowers.pushPrefEnv({
    set: [
      ["browser.sessionstore.restore_on_demand", true],
      ["browser.sessionstore.restore_tabs_lazily", true],
    ],
  });

  const BACKUP_STATE = SessionStore.getBrowserState();
  const REMOTE_URL = "http://www.example.com/";
  const ABOUT_ROBOTS_URI = "about:robots";
  const ABOUT_ROBOTS_TITLE = "Gort! Klaatu barada nikto!";
  const NO_TITLE_URL = "data:text/plain,foo";
  const EMPTY_TAB_TITLE = gBrowser.tabContainer.emptyTabTitle;

  function observeLabelChanges(tab, expectedLabels) {
    let seenLabels = [tab.label];
    function TabAttrModifiedListener(event) {
      if (event.detail.changed.some(attr => attr == "label")) {
        seenLabels.push(tab.label);
      }
    }
    tab.addEventListener("TabAttrModified", TabAttrModifiedListener);
    return async () => {
      await TestUtils.waitForCondition(
        () => seenLabels.length == expectedLabels.length,
        "saw " + seenLabels.length + " TabAttrModified events"
      );
      tab.removeEventListener("TabAttrModified", TabAttrModifiedListener);
      is(
        JSON.stringify(seenLabels),
        JSON.stringify(expectedLabels || []),
        "observed tab label changes"
      );
    };
  }

  info("setting test browser state");
  let browserLoadedPromise = BrowserTestUtils.firstBrowserLoaded(window, false);
  await promiseBrowserState({
    windows: [
      {
        tabs: [
          { entries: [{ url: REMOTE_URL, triggeringPrincipal_base64 }] },
          { entries: [{ url: ABOUT_ROBOTS_URI, triggeringPrincipal_base64 }] },
          { entries: [{ url: REMOTE_URL, triggeringPrincipal_base64 }] },
          { entries: [{ url: NO_TITLE_URL, triggeringPrincipal_base64 }] },
          { entries: [{ url: "about:blank", triggeringPrincipal_base64 }] },
        ],
      },
    ],
  });
  let [tab1, tab2, tab3, tab4, tab5] = gBrowser.tabs;
  is(gBrowser.selectedTab, tab1, "first tab is selected");

  await browserLoadedPromise;
  const REMOTE_TITLE = tab1.linkedBrowser.contentTitle;
  is(
    tab1.linkedBrowser.currentURI.spec,
    REMOTE_URL,
    "correct URL loaded in first tab"
  );
  is(typeof REMOTE_TITLE, "string", "content title is a string");
  isnot(REMOTE_TITLE.length, 0, "content title isn't empty");
  isnot(REMOTE_TITLE, REMOTE_URL, "content title is different from the URL");
  is(tab1.label, REMOTE_TITLE, "first tab displays content title");
  ok(
    document.title.startsWith(REMOTE_TITLE),
    "title bar displays content title"
  );
  ok(tab2.hasAttribute("pending"), "second tab is pending");
  ok(tab3.hasAttribute("pending"), "third tab is pending");
  ok(tab4.hasAttribute("pending"), "fourth tab is pending");
  is(tab5.label, EMPTY_TAB_TITLE, "fifth tab dislpays empty tab title");

  info("selecting the second tab");
  // The fix for bug 1364127 caused about: pages' initial tab titles to show
  // their about: URIs until their actual page titles are known, e.g.
  // "about:addons" -> "Add-ons Manager". This is bug 1371896. Previously,
  // about: pages' initial tab titles were blank until the page title was known.
  let finishObservingLabelChanges = observeLabelChanges(tab2, [
    ABOUT_ROBOTS_URI,
    ABOUT_ROBOTS_TITLE,
  ]);
  browserLoadedPromise = BrowserTestUtils.browserLoaded(
    tab2.linkedBrowser,
    false,
    ABOUT_ROBOTS_URI
  );
  gBrowser.selectedTab = tab2;
  await browserLoadedPromise;
  ok(!tab2.hasAttribute("pending"), "second tab isn't pending anymore");
  await finishObservingLabelChanges();
  ok(
    document.title.startsWith(ABOUT_ROBOTS_TITLE),
    "title bar displays content title"
  );

  info("selecting the third tab");
  finishObservingLabelChanges = observeLabelChanges(tab3, [
    "example.com/",
    REMOTE_TITLE,
  ]);
  browserLoadedPromise = BrowserTestUtils.browserLoaded(
    tab3.linkedBrowser,
    false,
    REMOTE_URL
  );
  gBrowser.selectedTab = tab3;
  await browserLoadedPromise;
  ok(!tab3.hasAttribute("pending"), "third tab isn't pending anymore");
  await finishObservingLabelChanges();
  ok(
    document.title.startsWith(REMOTE_TITLE),
    "title bar displays content title"
  );

  info("selecting the fourth tab");
  finishObservingLabelChanges = observeLabelChanges(tab4, [NO_TITLE_URL]);
  browserLoadedPromise = BrowserTestUtils.browserLoaded(
    tab4.linkedBrowser,
    false,
    NO_TITLE_URL
  );
  gBrowser.selectedTab = tab4;
  await browserLoadedPromise;
  ok(!tab4.hasAttribute("pending"), "fourth tab isn't pending anymore");
  await finishObservingLabelChanges();
  is(
    document.title,
    document.getElementById("bundle_brand").getString("brandFullName"),
    "title bar doesn't display content title since page doesn't have one"
  );

  info("restoring the modified browser state");
  gBrowser.selectedTab = tab3;
  await TabStateFlusher.flushWindow(window);
  await promiseBrowserState(SessionStore.getBrowserState());
  [tab1, tab2, tab3, tab4, tab5] = gBrowser.tabs;
  is(tab3, gBrowser.selectedTab, "third tab is selected after restoring");
  ok(
    document.title.startsWith(REMOTE_TITLE),
    "title bar displays content title"
  );
  ok(tab1.hasAttribute("pending"), "first tab is pending after restoring");
  ok(tab2.hasAttribute("pending"), "second tab is pending after restoring");
  is(tab2.label, ABOUT_ROBOTS_TITLE, "second tab displays content title");
  ok(!tab3.hasAttribute("pending"), "third tab is not pending after restoring");
  is(
    tab3.label,
    REMOTE_TITLE,
    "third tab displays content title in pending state"
  );
  ok(tab4.hasAttribute("pending"), "fourth tab is pending after restoring");
  is(tab4.label, NO_TITLE_URL, "fourth tab displays URL");
  is(tab5.label, EMPTY_TAB_TITLE, "fifth tab still displays empty tab title");

  info("selecting the first tab");
  finishObservingLabelChanges = observeLabelChanges(tab1, [REMOTE_TITLE]);
  let tabContentRestored = TestUtils.topicObserved(
    "sessionstore-debug-tab-restored"
  );
  gBrowser.selectedTab = tab1;
  ok(
    document.title.startsWith(REMOTE_TITLE),
    "title bar displays content title"
  );
  await tabContentRestored;
  ok(!tab1.hasAttribute("pending"), "first tab isn't pending anymore");
  await finishObservingLabelChanges();

  await promiseBrowserState(BACKUP_STATE);
});
