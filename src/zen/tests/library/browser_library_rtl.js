/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

// The library opens over the sidebar. Right-to-left locales mirror the
// window, so the sidebar is on the other side from what the right-side
// preference says, and the library has to follow it there.

requestLongerTimeout(2);

const { PromiseTestUtils } = ChromeUtils.importESModule(
  "resource://testing-common/PromiseTestUtils.sys.mjs"
);

// Closing a window whose library has rendered rejects inside lit's teardown,
// in left-to-right windows too. It is unrelated to the side checked here.
PromiseTestUtils.allowMatchingRejectionsGlobally(/wrap\$1\(\.\.\.\) is null/);

async function toggleLibraryIn(win, open) {
  const Library = win.customElements.get("zen-library");
  win.document.getElementById("cmd_zenToggleLibrary").doCommand();
  await TestUtils.waitForCondition(
    () =>
      Library.isLibraryOpen === open &&
      Library.libraryProgress === (open ? 1 : 0),
    open ? "library opened" : "library closed"
  );
}

async function checkLibrarySide(rightSide) {
  await SpecialPowers.pushPrefEnv({
    set: [
      ["zen.tabs.vertical.right-side", rightSide],
      ["zen.window-sync.enabled", false],
    ],
  });
  const win = await BrowserTestUtils.openNewBrowserWindow();
  ok(
    win.document.documentElement.matches(":-moz-locale-dir(rtl)"),
    "the new window is right to left"
  );

  await toggleLibraryIn(win, true);
  const windowCenter = win.innerWidth / 2;
  const libraryRect = win.document
    .querySelector("zen-library")
    .getBoundingClientRect();
  const toolboxRect = win.gNavToolbox.getBoundingClientRect();
  const contentRect = win.document
    .getElementById("tabbrowser-tabbox")
    .getBoundingClientRect();
  is(
    (libraryRect.left + libraryRect.right) / 2 > windowCenter,
    (toolboxRect.left + toolboxRect.right) / 2 > windowCenter,
    `library opens on the sidebar's side (right-side=${rightSide})`
  );
  ok(
    contentRect.right <= libraryRect.left + 1 ||
      contentRect.left >= libraryRect.right - 1,
    `web content is moved out from under the library (right-side=${rightSide})`
  );

  await toggleLibraryIn(win, false);
  await BrowserTestUtils.closeWindow(win);
  await SpecialPowers.popPrefEnv();
}

add_setup(async function () {
  await SpecialPowers.pushPrefEnv({ set: [["intl.l10n.pseudo", "bidi"]] });
});

add_task(async function test_library_rtl_left_pref() {
  await checkLibrarySide(false);
});

add_task(async function test_library_rtl_right_pref() {
  await checkLibrarySide(true);
});
