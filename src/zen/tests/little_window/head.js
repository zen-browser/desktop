/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const { ZenLittleWindow } = ChromeUtils.importESModule(
  "resource:///modules/zen/littlewindow/ZenLittleWindow.sys.mjs"
);
const { PromiseTestUtils } = ChromeUtils.importESModule(
  "resource://testing-common/PromiseTestUtils.sys.mjs"
);

PromiseTestUtils.allowMatchingRejectionsGlobally(
  /Cannot attach ID to a tab in a closed window/
);

const TEST_URL = "https://example.com/browser/";
const OTHER_URL = "https://example.org/browser/";

/**
 * Opens a little window and waits for it to be ready to use.
 *
 * @param {object} [options] What ZenLittleWindow.open() takes.
 * @returns {Promise<Window>}
 */
async function openLittleWindow(options = {}) {
  const win = ZenLittleWindow.open({ openerWindow: window, ...options });
  await TestUtils.topicObserved(
    "browser-delayed-startup-finished",
    subject => subject == win
  );
  await win.gZenStartup.promiseInitialized;
  return win;
}

/**
 * Opens a little window on a page and waits for the page to load.
 *
 * @param {object} [options] What ZenLittleWindow.open() takes.
 * @returns {Promise<Window>}
 */
async function openLittleWindowWithPage(options = {}) {
  const url = options.url ?? TEST_URL;
  const win = await openLittleWindow({ ...options, url });
  const browser = win.gBrowser.selectedBrowser;
  if (browser.currentURI.spec != url) {
    await BrowserTestUtils.browserLoaded(browser, false, url);
  }
  return win;
}

function isShown(win, id) {
  const element = win.document.getElementById(id);
  return (
    !!element && win.windowUtils.getBoundsWithoutFlushing(element).width > 0
  );
}
