/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const { AppUpdater } = ChromeUtils.importESModule(
  "resource://gre/modules/AppUpdater.sys.mjs"
);

const kAboutURL =
  "chrome://browser/content/zen-components/windows/zen-about.xhtml";

function countAboutWindows() {
  let count = 0;
  for (const win of Services.wm.getEnumerator("Browser:About")) {
    if (!win.closed) {
      count++;
    }
  }
  return count;
}

async function closeAboutWindows() {
  for (const win of Services.wm.getEnumerator("Browser:About")) {
    if (!win.closed) {
      await BrowserTestUtils.closeWindow(win);
    }
  }
}

async function openZenAboutDialog() {
  // A task that failed midway may have left its window behind, and
  // openAboutDialog() would focus that one instead of opening a new one.
  await closeAboutWindows();
  const opened = BrowserTestUtils.domWindowOpenedAndLoaded(
    null,
    win => win.location.href == kAboutURL
  );
  openAboutDialog();
  const win = await opened;
  await win.document.l10n.ready;
  // The dialog starts a real update check on open; keep the test in control
  // of the status row instead.
  win.zenAboutDialog.stopUpdateChecks();
  return win;
}

registerCleanupFunction(closeAboutWindows);

add_task(async function test_about_window_opens_once() {
  const win = await openZenAboutDialog();
  const root = win.document.documentElement;
  is(
    root.getAttribute("windowtype"),
    "Browser:About",
    "Zen owns the about window"
  );

  const version = win.document.getElementById("zen-about-version-text");
  ok(
    version.textContent.includes(AppConstants.MOZ_APP_VERSION_DISPLAY),
    `Version label "${version.textContent}" names the display version`
  );
  const firefoxVersion = win.document.getElementById(
    "zen-about-firefox-version"
  );
  ok(
    firefoxVersion.textContent.includes(AppConstants.ZEN_FIREFOX_VERSION),
    `Firefox label "${firefoxVersion.textContent}" names the engine version`
  );

  openAboutDialog();
  is(countAboutWindows(), 1, "Opening again reuses the existing window");

  await BrowserTestUtils.closeWindow(win);
  is(countAboutWindows(), 0, "The about window is gone after closing");
});

add_task(async function test_about_links() {
  const win = await openZenAboutDialog();
  const doc = win.document;

  is(
    doc.getElementById("zen-about-donate").href,
    "https://www.zen-browser.app/donate",
    "Donate link points at the donation page"
  );
  is(
    doc.getElementById("zen-about-issues").href,
    "https://github.com/zen-browser/desktop/issues",
    "Issues link points at the tracker"
  );
  const releaseNotes = doc.getElementById("zen-about-release-notes");
  ok(
    releaseNotes.href.includes("release-notes"),
    `Release notes link points at the release notes: ${releaseNotes.href}`
  );

  const tabOpened = BrowserTestUtils.waitForNewTab(
    gBrowser,
    "about:license",
    true
  );
  EventUtils.synthesizeMouseAtCenter(
    doc.querySelector('#zen-about-legal a[href="about:license"]'),
    {},
    win
  );
  const tab = await tabOpened;
  is(
    win.location.href,
    kAboutURL,
    "Clicking a link opens it in the browser instead of navigating the dialog"
  );

  BrowserTestUtils.removeTab(tab);
  await BrowserTestUtils.closeWindow(win);
});

add_task(async function test_about_update_states() {
  const win = await openZenAboutDialog();
  const doc = win.document;
  const dialog = win.zenAboutDialog;
  const section = doc.getElementById("zen-about-update");
  const text = doc.getElementById("zen-about-update-text");
  const button = doc.getElementById("zen-about-update-button");
  const progress = doc.getElementById("zen-about-update-progress");

  if (!AppConstants.MOZ_UPDATER) {
    ok(section.hidden, "Builds without an updater hide the update row");
    await BrowserTestUtils.closeWindow(win);
    return;
  }

  dialog.onUpdateStatus(AppUpdater.STATUS.CHECKING);
  is(section.dataset.state, "checking", "Checking state is reflected");
  is(
    text.getAttribute("data-l10n-id"),
    "zen-about-update-checking",
    "Checking text is shown"
  );
  ok(button.hidden, "No action while checking");

  dialog.onUpdateStatus(AppUpdater.STATUS.DOWNLOADING, 25, 100);
  is(section.dataset.state, "downloading", "Downloading state is reflected");
  ok(!progress.hidden, "Progress bar is visible while downloading");
  is(progress.value, 25, "Progress bar tracks the download");
  ok(
    doc.l10n.getAttributes(text).args.transfer,
    "Downloading text carries the transfer amount"
  );

  dialog.onUpdateStatus(AppUpdater.STATUS.READY_FOR_RESTART);
  is(section.dataset.state, "ready", "Ready state is reflected");
  ok(progress.hidden, "Progress bar hides once the download is done");
  ok(!button.hidden, "Restart button is offered");
  is(
    button.getAttribute("data-l10n-id"),
    "zen-about-update-restart",
    "Restart button is labelled"
  );
  ok(button.classList.contains("primary"), "Restart is the primary action");

  dialog.onUpdateStatus(AppUpdater.STATUS.DOWNLOAD_FAILED);
  is(section.dataset.state, "failed", "Failed state is reflected");
  is(
    button.getAttribute("data-l10n-id"),
    "zen-about-update-download-manually",
    "A failed download offers the manual download"
  );
  ok(!button.classList.contains("primary"), "Manual download is secondary");

  dialog.onUpdateStatus(AppUpdater.STATUS.NO_UPDATES_FOUND);
  await TestUtils.waitForCondition(
    () => section.dataset.state == "up-to-date",
    "Up to date state shows once the minimum checking time passes"
  );
  is(
    button.getAttribute("data-l10n-id"),
    "zen-about-update-check-again",
    "Up to date offers another check"
  );

  dialog.onUpdateStatus(AppUpdater.STATUS.NO_UPDATER);
  ok(section.hidden, "No updater hides the update row");

  await BrowserTestUtils.closeWindow(win);
});

add_task(async function test_about_escape_closes() {
  const win = await openZenAboutDialog();
  const closed = BrowserTestUtils.windowClosed(win);
  EventUtils.synthesizeKey("KEY_Escape", {}, win);
  await closed;
  is(countAboutWindows(), 0, "Escape closes the about window");
});
