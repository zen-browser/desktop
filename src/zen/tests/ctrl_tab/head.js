/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

function getPanel() {
  return document.getElementById("zen-ctrl-tab-panel");
}

function getCards() {
  return document.getElementById("zen-ctrl-tab-panel-cards");
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
  return getCards().children.length;
}

function getVisibleTabs() {
  let visibleTabs = Array.from(gBrowser.tabs).filter(
    (tab) => !tab.closing && tab.visible,
  );
  return visibleTabs;
}

function simulateClick(n) {
  let target = getCards().children[n];
  let promise = BrowserTestUtils.waitForEvent(target, "click");
  EventUtils.synthesizeMouseAtCenter(target, {});
  return promise;
}
