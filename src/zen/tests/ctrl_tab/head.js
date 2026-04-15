/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

function getPanel() {
  return document.getElementById("zen-ctrl-tab-panel");
}

async function openCtrlTabPanel(shiftKey = false) {
  let popupShown = BrowserTestUtils.waitForEvent(getPanel(), "popupshown");
  await gZenCtrlTabPanel.open(shiftKey);
  await popupShown;
}

async function closeCtrlTabPanel(switchTab = true) {
  let popupHidden = BrowserTestUtils.waitForEvent(getPanel(), "popuphidden");
  gZenCtrlTabPanel.close(switchTab);
  await popupHidden;
}

async function addTabs(n) {
  let tabs = [];
  for (let i = 0; i < n; i++) {
    let tab = BrowserTestUtils.addTab(gBrowser, "about:blank", {
      skipAnimation: true,
    });
    tabs.push(tab);
  }
  return tabs;
}

function getCardCount() {
  return document.getElementById("zen-ctrl-tab-panel-tabs")?.children.length ?? 0;
}
