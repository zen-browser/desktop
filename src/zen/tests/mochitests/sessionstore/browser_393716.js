/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const URL = "about:config";

add_setup(async function () {
  // Make sure that the field of which we restore the state is visible on load.
  await SpecialPowers.pushPrefEnv({
    set: [["browser.aboutConfig.showWarning", false]],
  });
});

/**
 * Bug 393716 - Basic tests for getTabState(), setTabState(), and duplicateTab().
 */
add_task(async function test_set_tabstate() {
  let key = "Unique key: " + Date.now();
  let value = "Unique value: " + Math.random();

  // create a new tab
  let tab = BrowserTestUtils.addTab(gBrowser, URL);
  ss.setCustomTabValue(tab, key, value);
  await promiseBrowserLoaded(tab.linkedBrowser);

  // get the tab's state
  await TabStateFlusher.flush(tab.linkedBrowser);
  let state = ss.getTabState(tab);
  ok(state, "get the tab's state");

  // verify the tab state's integrity
  state = JSON.parse(state);
  ok(
    state instanceof Object &&
      state.entries instanceof Array &&
      !!state.entries.length,
    "state object seems valid"
  );
  ok(
    state.entries.length == 1 && state.entries[0].url == URL,
    "Got the expected state object (test URL)"
  );
  ok(
    state.extData && state.extData[key] == value,
    "Got the expected state object (test manually set tab value)"
  );

  // clean up
  gBrowser.removeTab(tab);
});

add_task(async function test_set_tabstate_and_duplicate() {
  let key2 = "key2";
  let value2 = "Value " + Math.random();
  let value3 = "Another value: " + Date.now();
  let state = {
    entries: [{ url: URL, triggeringPrincipal_base64 }],
    extData: { key2: value2 },
  };

  // create a new tab
  let tab = BrowserTestUtils.addTab(gBrowser);
  // set the tab's state
  ss.setTabState(tab, JSON.stringify(state));
  await promiseBrowserLoaded(tab.linkedBrowser);

  // verify the correctness of the restored tab
  ok(
    ss.getCustomTabValue(tab, key2) == value2 &&
      tab.linkedBrowser.currentURI.spec == URL,
    "the tab's state was correctly restored"
  );

  // add text data
  await setPropertyOfFormField(
    tab.linkedBrowser,
    "#about-config-search",
    "value",
    value3
  );

  // duplicate the tab
  let tab2 = ss.duplicateTab(window, tab);
  await promiseTabRestored(tab2);

  // verify the correctness of the duplicated tab
  ok(
    ss.getCustomTabValue(tab2, key2) == value2 &&
      tab2.linkedBrowser.currentURI.spec == URL,
    "correctly duplicated the tab's state"
  );
  let textbox = await getPropertyOfFormField(
    tab2.linkedBrowser,
    "#about-config-search",
    "value"
  );
  is(textbox, value3, "also duplicated text data");

  // clean up
  gBrowser.removeTab(tab2);
  gBrowser.removeTab(tab);
});
