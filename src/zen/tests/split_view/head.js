/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

async function addTabTo(targetBrowser, url = "http://mochi.test:8888/", params = {}) {
  params.skipAnimation = true;
  const tab = BrowserTestUtils.addTab(targetBrowser, url, params);
  const browser = targetBrowser.getBrowserForTab(tab);
  await BrowserTestUtils.browserLoaded(browser);
  return tab;
}

function getUrlForNthTab(n) {
  return `data:text/plain,tab${n}`;
}

async function createSplitView(tabs, type = "grid") {
  const waitForActivationPromise = BrowserTestUtils.waitForEvent(
    window,
    "ZenViewSplitter:SplitViewActivated"
  );
  gZenViewSplitter.splitTabs(tabs, type);
  await waitForActivationPromise;
  await new Promise((resolve) => {
    setTimeout(async () => {
      resolve();
    }, 100);
  });
}

async function basicSplitNTabs(callback, type = "grid", n = 2) {
  Assert.greater(n, 1, "There should be at least two tabs");
  Assert.less(n, 5, "There should be at most four tabs");
  const tabs = await Promise.all(
    [...Array(n)].map((_, i) => addTabTo(gBrowser, getUrlForNthTab(i + 1)))
  );
  await createSplitView(tabs, type);
  await callback(tabs);
  for (const tab of tabs) {
    await BrowserTestUtils.removeTab(tab);
  }
}
