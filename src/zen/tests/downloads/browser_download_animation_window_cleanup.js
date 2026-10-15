/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const { Downloads } = ChromeUtils.importESModule(
  "resource://gre/modules/Downloads.sys.mjs"
);

function animationViewsForWindow(list, win) {
  return Array.from(list._views).filter(
    view =>
      Cu.getGlobalForObject(view) === win &&
      view.onDownloadAdded?.name === "bound #handleNewDownload"
  );
}

add_task(async function test_download_animation_view_removed_on_window_close() {
  const list = await Downloads.getList(Downloads.ALL);
  const win = await BrowserTestUtils.openNewBrowserWindow();
  let view;
  try {
    await TestUtils.waitForCondition(
      () => animationViewsForWindow(list, win).length === 1,
      "The window registers its download animation view"
    );
    [view] = animationViewsForWindow(list, win);
  } finally {
    await BrowserTestUtils.closeWindow(win);
  }

  ok(!list._views.has(view), "Closing the window removes its download view");
});

add_task(async function test_download_list_resolves_after_window_close() {
  const list = await Downloads.getList(Downloads.ALL);
  let resolveList;
  const pendingList = new Promise(resolve => {
    resolveList = resolve;
  });
  let getListCalled = false;
  const observer = win => {
    win.addEventListener(
      "DOMContentLoaded",
      () => {
        if (
          win.document.documentURI !== "chrome://browser/content/browser.xhtml"
        ) {
          return;
        }
        // Delay only this window's access to the shared list.
        const windowDownloads = Object.create(win.Downloads);
        windowDownloads.getList = type => {
          if (type === Downloads.ALL) {
            getListCalled = true;
            return pendingList;
          }
          return Downloads.getList(type);
        };
        Object.defineProperty(win, "Downloads", {
          configurable: true,
          value: windowDownloads,
        });
      },
      { capture: true, once: true }
    );
  };
  Services.obs.addObserver(observer, "domwindowopened");
  let win;
  try {
    win = await BrowserTestUtils.openNewBrowserWindow();
    ok(getListCalled, "Download animation is waiting for the list");
    is(
      animationViewsForWindow(list, win).length,
      0,
      "The pending list has no animation view yet"
    );
    await BrowserTestUtils.closeWindow(win);
    resolveList(list);
    await TestUtils.waitForTick();
    is(
      animationViewsForWindow(list, win).length,
      0,
      "The resolved list does not register a view for the closed window"
    );
  } finally {
    Services.obs.removeObserver(observer, "domwindowopened");
    resolveList(list);
    if (win && !win.closed) {
      await BrowserTestUtils.closeWindow(win);
    }
  }
});
