/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_task(async function test_Tab_Navigation() {
  await SpecialPowers.pushPrefEnv({
    set: [
      ["zen.tabs.ctrl-tab-panel.enabled", true],
      ["zen.tabs.ctrl-tab-panel.sort-by-recent", false],
    ],
  });

  let tabs = await addTabs(3);

  let visible = Array.from(gBrowser.tabs).filter(t => !t.closing && t.visible);
  is(visible.length, 4, "Should have 4 visible tabs");

  gBrowser.selectedTab = visible[2];

  // Forward: 2 → 3
  await openCtrlTabPanel();
  is(getPanel().state, "open", "Panel should be open");
  is(getCardCount(), 4, "Card count should match tab count");
  await closeCtrlTabPanel();
  is(getPanel().state, "closed", "Panel should be closed");
  is(gBrowser.selectedTab, visible[3], "Forward should move to next tab");

  // Forward wrap: 3 → 0
  await openCtrlTabPanel();
  await closeCtrlTabPanel();
  is(
    gBrowser.selectedTab,
    visible[0],
    "Forward from last should wrap to first"
  );

  // Backward wrap: 0 → 3
  await openCtrlTabPanel(true);
  await closeCtrlTabPanel();
  is(
    gBrowser.selectedTab,
    visible[3],
    "Backward from first should wrap to last"
  );

  // Backward: 3 → 2
  await openCtrlTabPanel(true);
  await closeCtrlTabPanel();
  is(gBrowser.selectedTab, visible[2], "Shift should go backward");

  // Forward without switch: stays at 2
  await openCtrlTabPanel();
  await closeCtrlTabPanel(false);
  is(gBrowser.selectedTab, visible[2], "close(false) should not switch");

  for (let tab of tabs) {
    BrowserTestUtils.removeTab(tab);
  }
  await SpecialPowers.popPrefEnv();
});

add_task(async function test_Multi_Navigate_While_Open() {
  await SpecialPowers.pushPrefEnv({
    set: [
      ["zen.tabs.ctrl-tab-panel.enabled", true],
      ["zen.tabs.ctrl-tab-panel.sort-by-recent", false],
    ],
  });

  let tabs = await addTabs(3);

  let visible = Array.from(gBrowser.tabs).filter(t => !t.closing && t.visible);
  gBrowser.selectedTab = visible[0];

  // Open, navigate forward twice, then close
  await openCtrlTabPanel();
  gZenCtrlTabPanel.navigateForward();
  gZenCtrlTabPanel.navigateForward();
  await closeCtrlTabPanel();
  is(gBrowser.selectedTab, visible[3], "Two forwards should land 3 ahead");

  // Open with shift, navigate backward, then close
  await openCtrlTabPanel(true);
  gZenCtrlTabPanel.navigateBackward();
  await closeCtrlTabPanel();
  is(gBrowser.selectedTab, visible[1], "One backward should land 2 behind");

  for (let tab of tabs) {
    BrowserTestUtils.removeTab(tab);
  }
  await SpecialPowers.popPrefEnv();
});

add_task(async function test_Disabled_Pref() {
  await SpecialPowers.pushPrefEnv({
    set: [
      ["zen.tabs.ctrl-tab-panel.enabled", false],
      ["zen.tabs.ctrl-tab-panel.sort-by-recent", true],
    ],
  });

  let tabs = await addTabs(2);
  EventUtils.synthesizeKey("VK_TAB", { ctrlKey: true });

  await new Promise(r => setTimeout(r, 200));
  isnot(
    getPanel().state,
    "open",
    "Panel should not open when pref is disabled"
  );

  if (getPanel().state === "open") {
    await closeCtrlTabPanel();
  }

  for (let tab of tabs) {
    BrowserTestUtils.removeTab(tab);
  }
  await SpecialPowers.popPrefEnv();
});

add_task(async function test_Less_Than_Two_Tabs() {
  await SpecialPowers.pushPrefEnv({
    set: [["zen.tabs.ctrl-tab-panel.enabled", true]],
  });

  await gZenCtrlTabPanel.open();
  isnot(
    getPanel().state,
    "open",
    "Panel should not open with less than two tabs"
  );

  if (getPanel().state === "open") {
    await closeCtrlTabPanel();
  }

  let tabs = await addTabs(1);
  await openCtrlTabPanel();
  is(getPanel().state, "open", "Panel should open with two tabs");
  await closeCtrlTabPanel();

  for (let tab of tabs) {
    BrowserTestUtils.removeTab(tab);
  }
  await SpecialPowers.popPrefEnv();
});

add_task(async function test_Recent_Sort_Order() {
  await SpecialPowers.pushPrefEnv({
    set: [
      ["zen.tabs.ctrl-tab-panel.enabled", true],
      ["zen.tabs.ctrl-tab-panel.sort-by-recent", true],
    ],
  });

  let tabs = await addTabs(3);

  gBrowser.selectedTab = tabs[0];
  await new Promise(r => setTimeout(r, 50));
  gBrowser.selectedTab = tabs[1];
  await new Promise(r => setTimeout(r, 50));
  gBrowser.selectedTab = tabs[2];

  await openCtrlTabPanel();
  await closeCtrlTabPanel();

  is(
    gBrowser.selectedTab,
    tabs[1],
    "Should switch to the second most recently used tab"
  );

  for (let tab of tabs) {
    BrowserTestUtils.removeTab(tab);
  }
  await SpecialPowers.popPrefEnv();
});
