/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const { ZenSettings } = ChromeUtils.importESModule(
  "resource:///modules/zen/settings/ZenSettings.sys.mjs"
);
const { UIState } = ChromeUtils.importESModule(
  "resource://services-sync/UIState.sys.mjs"
);
const { SearchService } = ChromeUtils.importESModule(
  "moz-src:///toolkit/components/search/SearchService.sys.mjs"
);

function countSettingsWindows() {
  let count = 0;
  for (const win of Services.wm.getEnumerator(ZenSettings.windowType)) {
    if (!win.closed) {
      count++;
    }
  }
  return count;
}

async function closeSettingsWindows() {
  for (const win of Services.wm.getEnumerator(ZenSettings.windowType)) {
    if (!win.closed) {
      await BrowserTestUtils.closeWindow(win);
    }
  }
}

async function openSettingsWindow(open = () => openPreferences()) {
  await closeSettingsWindows();
  const opened = BrowserTestUtils.domWindowOpenedAndLoaded(
    null,
    win => win.location.href == ZenSettings.windowURL
  );
  open();
  const win = await opened;
  await win.document.l10n.ready;
  return win;
}

async function expectFirefoxSettingsTab(callback) {
  await BrowserTestUtils.withNewTab("about:mozilla", async () => {
    const tabOpened = BrowserTestUtils.waitForNewTab(
      gBrowser,
      url => url.startsWith("about:preferences"),
      true
    );
    await callback();
    BrowserTestUtils.removeTab(await tabOpened);
  });
}

function toggleFor(win, pref) {
  return win.document.querySelector(`moz-toggle[data-pref="${pref}"]`);
}

async function clickToggle(toggle) {
  const toggled = BrowserTestUtils.waitForEvent(toggle, "toggle");
  toggle.click();
  await toggled;
}

function isPaneShown(win, name) {
  const pane = win.document.getElementById(`zen-settings-pane-${name}`);
  return !pane.hidden;
}

function setSyncState(state) {
  UIState.get = () => state;
  Services.obs.notifyObservers(null, UIState.ON_UPDATE);
}

const originalUIStateGet = UIState.get;
registerCleanupFunction(async () => {
  UIState.get = originalUIStateGet;
  await closeSettingsWindows();
});
