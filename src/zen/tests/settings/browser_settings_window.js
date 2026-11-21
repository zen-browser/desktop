/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_task(async function test_open_preferences_opens_zen_window_once() {
  const tabCount = gBrowser.tabs.length;
  const win = await openSettingsWindow();
  is(
    win.document.documentElement.getAttribute("windowtype"),
    ZenSettings.windowType,
    "openPreferences() opens Zen's settings window"
  );
  is(gBrowser.tabs.length, tabCount, "No settings tab was opened");
  ok(isPaneShown(win, "general"), "The window starts on the General pane");

  openPreferences();
  is(countSettingsWindows(), 1, "Opening again reuses the existing window");

  ZenSettings.open("links");
  is(countSettingsWindows(), 1, "Asking for a pane reuses the window too");
  ok(isPaneShown(win, "links"), "The requested pane is shown");

  await BrowserTestUtils.closeWindow(win);
});

add_task(async function test_open_with_initial_pane() {
  const win = await openSettingsWindow(() => ZenSettings.open("advanced"));
  ok(isPaneShown(win, "advanced"), "The window opens on the requested pane");
  ok(!isPaneShown(win, "general"), "The default pane stays hidden");
  await BrowserTestUtils.closeWindow(win);
});

add_task(async function test_pane_requests_still_reach_firefox_settings() {
  await closeSettingsWindows();
  await expectFirefoxSettingsTab(() => openPreferences("paneGeneral"));
  is(countSettingsWindows(), 0, "A pane request doesn't open Zen's window");
});

add_task(async function test_navigation() {
  const win = await openSettingsWindow();
  const doc = win.document;
  const title = doc.getElementById("zen-settings-title");

  for (const category of doc.querySelectorAll(
    ".zen-settings-category[data-pane]"
  )) {
    const name = category.dataset.pane;
    category.click();
    ok(isPaneShown(win, name), `Clicking shows the ${name} pane`);
    is(
      doc.querySelectorAll(".zen-settings-pane:not([hidden])").length,
      1,
      `Only the ${name} pane is shown`
    );
    is(category.getAttribute("aria-selected"), "true", `${name} is selected`);
    is(
      title.dataset.l10nId,
      category.querySelector("span").dataset.l10nId,
      `The header names the ${name} pane`
    );
  }

  win.gZenSettingsWindow.showPane("does-not-exist");
  ok(isPaneShown(win, "general"), "An unknown pane falls back to General");

  await BrowserTestUtils.closeWindow(win);
});

add_task(async function test_about_link_opens_the_about_dialog() {
  const win = await openSettingsWindow();
  const aboutOpened = BrowserTestUtils.domWindowOpenedAndLoaded(
    null,
    w =>
      w.document.documentElement.getAttribute("windowtype") == "Browser:About"
  );
  win.document
    .querySelector('#zen-settings-links [data-action="open-about"]')
    .click();
  const about = await aboutOpened;
  ok(!win.closed, "The settings window stays open");
  await BrowserTestUtils.closeWindow(about);
  await BrowserTestUtils.closeWindow(win);
});

add_task(async function test_images_cannot_be_dragged() {
  setSyncState({
    status: UIState.STATUS_SIGNED_IN,
    email: "zen@example.com",
    syncEnabled: true,
  });
  const win = await openSettingsWindow();
  for (const img of win.document.querySelectorAll("#zen-settings-root img")) {
    is(
      win.getComputedStyle(img).pointerEvents,
      "none",
      `${img.id || img.getAttribute("src")} can't be grabbed`
    );
  }
  UIState.get = originalUIStateGet;
  await BrowserTestUtils.closeWindow(win);
});

add_task(async function test_firefox_settings_links_close_the_window() {
  for (const action of ["open-more-settings", "open-mods"]) {
    const win = await openSettingsWindow();
    const closed = BrowserTestUtils.domWindowClosed(win);
    await expectFirefoxSettingsTab(() =>
      win.document
        .querySelector(`#zen-settings-links [data-action="${action}"]`)
        .click()
    );
    await closed;
    is(countSettingsWindows(), 0, `${action} closes the settings window`);
  }
});
