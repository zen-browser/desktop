/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const { ZenTabArchiver } = ChromeUtils.importESModule(
  "resource:///modules/zen/ZenTabArchiver.sys.mjs"
);

const TIMEOUT_MINUTES = 12 * 60;
const MS_PER_MINUTE = 60 * 1000;

add_setup(async function () {
  await SpecialPowers.pushPrefEnv({
    set: [["zen.tabs.auto-archive.timeout-minutes", TIMEOUT_MINUTES]],
  });
});

/**
 * Makes a tab look like nobody has opened it for longer than the timeout.
 *
 * @param {MozTabbrowserTab} tab - A tab that isn't selected
 */
function makeIdle(tab) {
  tab.updateLastAccessed(Date.now() - (TIMEOUT_MINUTES + 1) * MS_PER_MINUTE);
}

/**
 * Opens a background tab in this window and waits for its copy in another.
 *
 * @param {Window} win - The other synced window
 * @param {string} url - The page to open
 * @returns {Promise<MozTabbrowserTab[]>} The tab and its copy in `win`
 */
async function openSyncedTab(win, url) {
  const tab = gBrowser.addTrustedTab(url, { inBackground: true });
  await TestUtils.waitForCondition(
    () => gZenWindowSync.getItemFromWindow(win, tab.id),
    "The tab is copied into the other window"
  );
  return [tab, gZenWindowSync.getItemFromWindow(win, tab.id)];
}

add_task(async function test_tab_shown_in_another_window_is_kept() {
  // The shown tab is left for the cleanup at the end of the file: window sync
  // is still moving its page back here once the other window closes.
  await withNewSyncedWindow(async win => {
    await win.gZenStartup.promiseInitialized;
    const [shown, shownCopy] = await openSyncedTab(
      win,
      "https://example.com/?a"
    );
    const [idle, idleCopy] = await openSyncedTab(win, "https://example.com/?b");
    win.gBrowser.selectedTab = shownCopy;
    for (const tab of [shown, idle, idleCopy]) {
      makeIdle(tab);
    }

    const archived = ZenTabArchiver.sweep();

    ok(
      archived.includes(idle) || archived.includes(idleCopy),
      "A tab unopened in every window is archived"
    );
    ok(idle.closing && idleCopy.closing, "From every window");
    ok(
      !shown.closing && !shownCopy.closing,
      "A tab shown in another window is kept, though its copy here is idle"
    );
  });
});

add_task(async function test_tab_used_in_a_closed_window_is_kept() {
  let tab;
  await withNewSyncedWindow(async win => {
    await win.gZenStartup.promiseInitialized;
    let copy;
    [tab, copy] = await openSyncedTab(win, "https://example.com/?c");
    win.gBrowser.selectedTab = copy;
    makeIdle(tab);
    ok(
      !ZenTabArchiver.sweep().includes(tab),
      "The tab is kept while it is shown in the other window"
    );
  });

  const control = gBrowser.addTrustedTab("https://example.com/?d", {
    inBackground: true,
  });
  await TestUtils.waitForCondition(() => control.id, "The tab has its id");
  makeIdle(tab);
  makeIdle(control);

  const archived = ZenTabArchiver.sweep();

  ok(archived.includes(control), "Tabs nobody opened are still archived");
  ok(
    !archived.includes(tab) && !tab.closing,
    "But not one that was in use in a window that has since closed"
  );
  BrowserTestUtils.removeTab(tab);
});
