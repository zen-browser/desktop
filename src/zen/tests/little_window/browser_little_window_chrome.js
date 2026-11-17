/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const { BrowserWindowTracker } = ChromeUtils.importESModule(
  "resource:///modules/BrowserWindowTracker.sys.mjs"
);

add_task(async function test_little_window_chrome() {
  const win = await openLittleWindow({ url: TEST_URL });
  const root = win.document.documentElement;

  ok(ZenLittleWindow.isLittleWindow(win), "The window is a little window");
  ok(!ZenLittleWindow.isLittleWindow(window), "The opener is not one");
  ok(
    root.hasAttribute("zen-unsynced-window"),
    "A little window is a blank window"
  );
  ok(
    !root.hasAttribute("zen-single-toolbar"),
    "A little window keeps the toolbar on top"
  );
  is(root.getAttribute("persist"), "none", "Its size is not persisted");
  Assert.less(
    win.outerWidth,
    window.outerWidth,
    "A little window is smaller than a regular one"
  );

  ok(!isShown(win, "navigator-toolbox"), "The sidebar is hidden");
  ok(isShown(win, "urlbar-container"), "The URL bar is shown");
  ok(isShown(win, "zen-little-window-open-button"), "Open in space is shown");
  ok(isShown(win, "zen-little-window-container"), "The container is shown");
  ok(!isShown(win, "PanelUI-button"), "The app menu button is hidden");
  ok(
    win.document.getElementById("zen-little-window-container-icon").hidden,
    "No container means no container icon"
  );
  is(
    win.document.getElementById("zen-little-window-container-label").value,
    "Default",
    "And the name spaces give that"
  );

  is(
    win.gURLBar.zenUrlbarBehavior,
    "float",
    "The URL bar always opens floating, however it is opened"
  );
  await TestUtils.waitForCondition(
    () => win.gURLBar.value == "example.com",
    "The URL bar shows only the domain"
  );
  is(
    win.getComputedStyle(win.gURLBar.inputField).cursor,
    "default",
    "The closed URL bar does not take the text cursor"
  );

  Assert.notEqual(
    BrowserWindowTracker.getTopWindow(),
    win,
    "A little window is never the window links open in"
  );

  await BrowserTestUtils.closeWindow(win);
});

add_task(async function test_little_window_intro() {
  const PREF = "zen.little-window.intro-dismissed";
  Services.prefs.clearUserPref(PREF);
  registerCleanupFunction(() => Services.prefs.clearUserPref(PREF));

  let win = await openLittleWindow({ url: TEST_URL });
  const intro = win.document.getElementById("zen-little-window-intro");
  Assert.greater(
    intro?.getBoundingClientRect().width,
    0,
    "A new window says what it is"
  );
  win.document.getElementById("zen-little-window-intro-close").doCommand();
  ok(
    !win.document.getElementById("zen-little-window-intro"),
    "Closing the message removes it"
  );
  await BrowserTestUtils.closeWindow(win);

  win = await openLittleWindow({ url: TEST_URL });
  ok(
    !win.document.getElementById("zen-little-window-intro"),
    "And it does not come back in the next window"
  );
  await BrowserTestUtils.closeWindow(win);
});

add_task(async function test_little_window_disabled() {
  await SpecialPowers.pushPrefEnv({
    set: [["zen.little-window.enabled", false]],
  });
  ok(!ZenLittleWindow.enabled, "Little windows follow the preference");
  is(
    ZenLittleWindow.open({ openerWindow: window }),
    null,
    "None opens while they are disabled"
  );
  await SpecialPowers.popPrefEnv();
});

add_task(async function test_little_window_shows_its_downloads() {
  const win = await openLittleWindow({ url: TEST_URL });
  const list = await Downloads.getList(Downloads.ALL);
  const cards = () =>
    win.document.querySelectorAll(".zen-little-window-download");

  const elsewhere = await Downloads.createDownload({
    source: {
      url: "https://example.com/other.zip",
      browsingContextId: gBrowser.selectedBrowser.browsingContext.id,
    },
    target: PathUtils.join(PathUtils.tempDir, "other.zip"),
  });
  await list.add(elsewhere);
  ok(!cards().length, "A download from another window is not shown");

  const download = await Downloads.createDownload({
    source: {
      url: "https://example.com/file.zip",
      browsingContextId: win.gBrowser.selectedBrowser.browsingContext.id,
    },
    target: PathUtils.join(PathUtils.tempDir, "little-window.zip"),
  });
  await list.add(download);
  await TestUtils.waitForCondition(
    () => cards().length,
    "A download from the little window gets a card"
  );
  const [card] = cards();
  await win.document.l10n.translateFragment(card);
  is(
    card.querySelector(".zen-little-window-download-name").value,
    "little-window.zip",
    "With its file name"
  );
  is(
    card.querySelector(".zen-little-window-download-source").value,
    "From example.com",
    "And where it is from"
  );
  const rect = card.getBoundingClientRect();
  const box = win.document
    .getElementById("tabbrowser-tabbox")
    .getBoundingClientRect();
  Assert.greater(rect.width, 0, "The card is shown");
  Assert.less(rect.left - box.left, 20, "At the start of the window");
  Assert.less(box.bottom - rect.bottom, 20, "And at its bottom");

  const status = card.querySelector(".zen-little-window-download-status");
  ok(!status.getBoundingClientRect().width, "Nothing to report until it runs");
  download.stopped = false;
  download.hasProgress = true;
  download.progress = 40;
  download.currentBytes = 400;
  download.totalBytes = 1000;
  download._notifyChange();
  ok(card.hasAttribute("downloading"), "A running download is marked as one");
  is(
    card.style.getPropertyValue("--zen-little-window-download-progress"),
    "40%",
    "Its progress is drawn"
  );
  ok(status.value.includes("400"), `And written out: ${status.value}`);
  Assert.greater(status.getBoundingClientRect().width, 0, "In view");
  download.stopped = true;
  download.succeeded = true;
  download._notifyChange();
  ok(card.hasAttribute("done"), "A finished download is marked as done");
  ok(!status.getBoundingClientRect().width, "And says where it is from again");

  const second = await Downloads.createDownload({
    source: {
      url: "https://example.com/second.zip",
      browsingContextId: win.gBrowser.selectedBrowser.browsingContext.id,
    },
    target: PathUtils.join(PathUtils.tempDir, `${"long-name-".repeat(12)}.zip`),
  });
  await list.add(second);
  await TestUtils.waitForCondition(() => cards().length == 2, "A second card");
  const secondRect = cards()[1].getBoundingClientRect();
  Assert.greaterOrEqual(secondRect.left, rect.right, "Sits next to the first");
  is(secondRect.top, rect.top, "On the same row");
  is(secondRect.width, rect.width, "A long name does not widen its card");
  Assert.lessOrEqual(
    cards()[1]
      .querySelector(".zen-little-window-download-name")
      .getBoundingClientRect().right,
    secondRect.right,
    "And stays inside it"
  );
  second.stopped = false;
  let cancelled = false;
  second.cancel = async () => {
    cancelled = true;
  };
  second.removePartialData = async () => {};
  cards()[1].querySelector(".zen-little-window-download-close").doCommand();
  is(cards().length, 1, "The close button takes its card away");
  ok(cancelled, "And cancels a download that is still running");

  let cancelledFinished = false;
  download.cancel = async () => {
    cancelledFinished = true;
  };
  card.querySelector(".zen-little-window-download-close").doCommand();
  ok(!cards().length, "A finished download is dismissed the same way");
  ok(!cancelledFinished, "With nothing left to cancel");
  ok((await list.getAll()).includes(download), "And it stays in the list");
  await list.remove(second);

  await list.remove(download);
  await list.remove(elsewhere);
  await BrowserTestUtils.closeWindow(win);
});

add_task(async function test_little_window_is_named_in_its_title() {
  const win = await openLittleWindowWithPage();
  const contentTitle = win.gBrowser.selectedBrowser.contentTitle;
  await TestUtils.waitForCondition(
    () => win.document.title.endsWith("Little Zen"),
    "The title of the window says what it is"
  );
  ok(
    !win.document.title.includes(
      win.document.getElementById("mainWindowTitle").textContent
    ),
    "In place of the name of the browser"
  );
  if (contentTitle) {
    is(
      win.document.title,
      `${contentTitle} — Little Zen`,
      "After the title of its page"
    );
  }
  ok(!document.title.includes("Little Zen"), "A regular window is not");

  await BrowserTestUtils.closeWindow(win);
});

add_task(async function test_little_window_remembers_its_size() {
  const defaultSize = ZenLittleWindow.windowSize;
  registerCleanupFunction(() =>
    ZenLittleWindow.rememberWindowSize(defaultSize)
  );

  let win = await openLittleWindow({ url: TEST_URL });
  const width = win.innerWidth - 160;
  const height = win.innerHeight - 120;
  const resized = BrowserTestUtils.waitForEvent(win, "resize");
  win.resizeTo(
    width + win.outerWidth - win.innerWidth,
    height + win.outerHeight - win.innerHeight
  );
  await resized;
  await BrowserTestUtils.closeWindow(win);
  Assert.deepEqual(
    ZenLittleWindow.windowSize,
    { width, height },
    "The size a little window is left at is kept"
  );

  win = await openLittleWindow({ url: TEST_URL });
  is(win.innerWidth, width, "The next one opens as wide");
  is(win.innerHeight, height, "And as tall");
  await BrowserTestUtils.closeWindow(win);

  win = await openLittleWindow();
  await BrowserTestUtils.closeWindow(win);
  Assert.deepEqual(
    ZenLittleWindow.windowSize,
    { width, height },
    "A window that was only a URL bar leaves it alone"
  );

  ZenLittleWindow.rememberWindowSize(defaultSize);
});
