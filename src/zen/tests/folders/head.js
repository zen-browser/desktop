/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

'use strict';

async function removeFolder(folder) {
  if (!folder) return;
  const removeEvent = BrowserTestUtils.waitForEvent(folder, 'TabGroupRemoved');
  folder.delete();
  await removeEvent;
}

async function openFolderContextMenu(folder) {
  const popup = document.getElementById('zenFolderActions');
  let menuEvent = BrowserTestUtils.waitForEvent(popup, 'popupshown');
  EventUtils.synthesizeMouseAtCenter(folder.labelElement, {
    type: 'contextmenu',
  });
  await menuEvent;
}

async function addTabTo(targetBrowser, url = 'http://mochi.test:8888/', params = {}) {
  params.skipAnimation = true;
  const tab = BrowserTestUtils.addTab(targetBrowser, url, params);
  const browser = targetBrowser.getBrowserForTab(tab);
  await BrowserTestUtils.browserLoaded(browser);
  return tab;
}
