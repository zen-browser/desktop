/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

'use strict';

// Each firefox update, we should run this check, even
// if its a very "basic" one. Just to make sure that we are
// returning tabs correctly.
add_task(async function test_Tabs_Getter() {
  for (let tab of gBrowser.tabs) {
    ok(tab.tagName.toLowerCase() === 'tab', 'Each item in gBrowser.tabs is a tab element');
  }
  Assert.equal(
    gBrowser.tabs.length,
    2,
    'There should be 2 tabs (1 empty tab + 1 about:blank tab) at startup'
  );
});

add_task(async function test_Aria_Focusable_Tabs() {
  for (let tab of gBrowser.tabContainer.ariaFocusableItems) {
    ok(tab.tagName.toLowerCase() === 'tab', 'Each item in ariaFocusableItems is a tab element');
  }
  Assert.equal(
    gBrowser.tabContainer.ariaFocusableItems.length,
    1,
    'There should be 1 focusable tab (1 about:blank tab) at startup'
  );
});
