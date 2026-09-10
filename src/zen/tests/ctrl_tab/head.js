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
  const popupShown = BrowserTestUtils.waitForEvent(getPanel(), "popupshown");
  EventUtils.synthesizeKey("VK_CONTROL", { type: "keydown" });
  EventUtils.synthesizeKey("VK_TAB", {
    ctrlKey: true,
    shiftKey,
    type: "keydown",
  });
  await popupShown;
}

async function closeCtrlTabPanel() {
  const popupHidden = BrowserTestUtils.waitForEvent(getPanel(), "popuphidden");
  EventUtils.synthesizeKey("VK_CONTROL", { type: "keyup" });
  await popupHidden;
}

async function clickOutsidePanel() {
  const popupHidden = BrowserTestUtils.waitForEvent(getPanel(), "popuphidden");
  EventUtils.synthesizeMouseAtCenter(document.getElementById("nav-bar"), {});
  await popupHidden;
}

async function addTabs(n) {
  const tabs = [];
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
  return Array.from(gBrowser.tabs).filter(tab => !tab.closing && tab.visible);
}

function pressTab(n = 1) {
  for (let i = 0; i < n; i++) {
    EventUtils.synthesizeKey("VK_TAB", { ctrlKey: true, type: "keydown" });
  }
}

function pressShiftTab(n = 1) {
  for (let i = 0; i < n; i++) {
    EventUtils.synthesizeKey("VK_TAB", {
      ctrlKey: true,
      shiftKey: true,
      type: "keydown",
    });
  }
}

function simulateClick(n) {
  const target = getCards().children[n];
  const promise = BrowserTestUtils.waitForEvent(target, "click");
  EventUtils.synthesizeMouseAtCenter(target, {});
  return promise;
}
