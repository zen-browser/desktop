/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_task(async function test_shortcuts_pane() {
  const { CustomKeys } = ChromeUtils.importESModule(
    "moz-src:///browser/components/customkeys/CustomKeys.sys.mjs"
  );
  const kKeyId = "zen-compact-mode-toggle";
  registerCleanupFunction(() => CustomKeys.resetKey(kKeyId));

  const win = await openSettingsWindow(() => ZenSettings.open("shortcuts"));
  const doc = win.document;
  const list = doc.getElementById("zen-settings-shortcuts-list");
  await TestUtils.waitForCondition(
    () => list.querySelector(".zen-settings-shortcut"),
    "The shortcuts are listed"
  );
  const allRows = () => [...list.querySelectorAll(".zen-settings-shortcut")];
  const row = () => list.querySelector(`[data-id="${kKeyId}"]`);
  const keycap = () => row().querySelector(".zen-settings-keycap");
  const sectionOf = el => el.closest(".zen-settings-shortcut-category");
  const customSection = () =>
    list.querySelector(
      '.zen-settings-shortcut-category:has(> h3[data-l10n-id="zen-settings-window-shortcuts-customized"])'
    );
  const title = doc.getElementById("zen-settings-shortcuts-title");
  const resetButton = doc.getElementById("zen-settings-shortcuts-reset");
  const art = doc.getElementById("zen-settings-shortcuts-art");
  const artKeys = () =>
    [...art.querySelectorAll("[data-key]")].map(k => k.dataset.key);
  const keyEl = document.getElementById(kKeyId);

  Assert.greater(allRows().length, 20, "Many shortcuts are listed");
  ok(
    allRows().every(
      r => r.dataset.label && !r.dataset.label.startsWith("customkeys-")
    ),
    "Every shortcut has a readable name"
  );
  Assert.greater(
    list.querySelectorAll(".zen-settings-shortcut-category").length,
    3,
    "Shortcuts are grouped in categories"
  );
  ok(row(), "Zen's own shortcuts are listed");
  ok(!customSection(), "There is no custom section without custom shortcuts");
  const original = row().dataset.shortcut;

  ok(art.hasAttribute("data-default"), "Nothing selected: the default art");
  ok(resetButton.disabled, "Nothing selected: there is nothing to reset");

  const face = doc.getElementById("zen-settings-shortcuts-face");
  const faceRect = face.parentElement.getBoundingClientRect();
  const lean = (x, y) => {
    doc.dispatchEvent(
      new win.MouseEvent("mousemove", { clientX: x, clientY: y, bubbles: true })
    );
    return face.style.translate.split(" ").map(parseFloat);
  };
  let [leanX, leanY] = lean(faceRect.x - 200, faceRect.y + 300);
  Assert.less(leanX, 0, "The face leans left towards the pointer");
  Assert.greater(leanY, 0, "The face leans down towards the pointer");
  [leanX, leanY] = lean(faceRect.right + 5000, faceRect.y - 5000);
  Assert.greater(leanX, 0, "The face leans right towards the pointer");
  Assert.less(leanY, 0, "The face leans up towards the pointer");
  Assert.less(Math.hypot(leanX, leanY), 6, "The face stays on its key");

  const search = doc.getElementById("zen-settings-shortcuts-search");
  search.value = row().dataset.label;
  search.dispatchEvent(new win.Event("input", { bubbles: true }));
  ok(!row().hidden, "Searching keeps the matching shortcut");
  Assert.less(
    allRows().filter(r => !r.hidden).length,
    allRows().length,
    "Searching hides the other shortcuts"
  );
  search.value = "no shortcut is called this";
  search.dispatchEvent(new win.Event("input", { bubbles: true }));
  ok(
    !doc.getElementById("zen-settings-shortcuts-empty").hidden,
    "A search without matches says so"
  );
  search.value = "";
  search.dispatchEvent(new win.Event("input", { bubbles: true }));
  ok(
    allRows().every(r => !r.hidden),
    "Clearing the search shows everything"
  );

  row().querySelector(".zen-settings-shortcut-label").click();
  is(row().getAttribute("aria-selected"), "true", "Clicking a row selects it");
  is(
    list.querySelectorAll('[aria-selected="true"]').length,
    1,
    "Only one shortcut is selected"
  );
  is(title.textContent, row().dataset.label, "The panel names the shortcut");
  ok(!art.hasAttribute("data-default"), "The art shows the shortcut's keys");
  is(artKeys().join(""), original.replaceAll("+", ""), "Key by key");
  ok(resetButton.disabled, "A default shortcut can't be reset");
  ok(
    !keycap().hasAttribute("data-recording"),
    "Selecting a row doesn't record"
  );

  keycap().click();
  ok(keycap().hasAttribute("data-recording"), "Clicking the keys records");
  EventUtils.synthesizeKey("KEY_Escape", {}, win);
  ok(!keycap().hasAttribute("data-recording"), "Escape stops recording");
  is(row().dataset.shortcut, original, "Escape leaves the shortcut alone");

  keycap().click();
  EventUtils.synthesizeKey("y", {}, win);
  ok(
    keycap().hasAttribute("data-recording"),
    "A key without modifiers isn't accepted as a shortcut"
  );
  EventUtils.synthesizeKey(
    "y",
    { accelKey: true, altKey: true, shiftKey: true },
    win
  );
  await TestUtils.waitForCondition(
    () => row().hasAttribute("data-customized"),
    "A valid shortcut is stored"
  );
  isnot(row().dataset.shortcut, original, "The row shows the new shortcut");
  is(keycap().textContent, row().dataset.shortcut, "So does its key cap");
  is(keyEl.getAttribute("key"), "Y", "The browser's key was changed");
  is(
    keyEl.getAttribute("modifiers"),
    "accel,alt,shift",
    "The browser's key got the new modifiers"
  );
  is(sectionOf(row()), customSection(), "It moved to the custom section");
  is(customSection(), list.firstElementChild, "Which is the first section");
  is(row().getAttribute("aria-selected"), "true", "It stays selected");
  is(artKeys().length, 4, "The art shows the three modifiers and the key");
  is(artKeys().at(-1), "Y", "The key comes last");
  ok(!resetButton.disabled, "A customized shortcut can be reset");

  resetButton.click();
  await TestUtils.waitForCondition(
    () => row().dataset.shortcut == original,
    "Resetting restores the default shortcut"
  );
  ok(!customSection(), "The custom section goes away again");
  ok(resetButton.disabled, "And there is nothing left to reset");

  keycap().click();
  EventUtils.synthesizeKey("KEY_Delete", {}, win);
  await TestUtils.waitForCondition(
    () => row().dataset.shortcut == "",
    "Delete removes the shortcut"
  );
  ok(!keyEl.hasAttribute("key"), "The browser's key was cleared");
  is(
    keycap().dataset.l10nId,
    "zen-settings-window-shortcuts-unassigned",
    "A removed shortcut is shown as unassigned"
  );
  ok(art.hasAttribute("data-default"), "Without keys the art is the default");
  CustomKeys.resetKey(kKeyId);

  const { shortcutKeys } =
    win.gZenSettingsWindow.sections.shortcuts.constructor;
  Assert.deepEqual(shortcutKeys("⇧⌘N"), ["⇧", "⌘", "N"], "macOS symbols");
  Assert.deepEqual(shortcutKeys("⌥⌘F12"), ["⌥", "⌘", "F12"], "macOS key name");
  Assert.deepEqual(
    shortcutKeys("Ctrl+Shift+N"),
    ["Ctrl", "Shift", "N"],
    "Named modifiers"
  );
  Assert.deepEqual(shortcutKeys("Ctrl++"), ["Ctrl", "+"], "The plus key");
  Assert.deepEqual(shortcutKeys("⌘"), ["⌘"], "A lone symbol is the key");
  Assert.deepEqual(shortcutKeys(""), [], "No shortcut, no keys");

  await BrowserTestUtils.closeWindow(win);
});

add_task(async function test_shortcut_key_caps_fit_on_one_line() {
  const { CustomKeys } = ChromeUtils.importESModule(
    "moz-src:///browser/components/customkeys/CustomKeys.sys.mjs"
  );
  const kKeyId = "zen-compact-mode-toggle";
  registerCleanupFunction(() => CustomKeys.resetKey(kKeyId));

  const win = await openSettingsWindow(() => ZenSettings.open("shortcuts"));
  const doc = win.document;
  const list = doc.getElementById("zen-settings-shortcuts-list");
  const art = doc.getElementById("zen-settings-shortcuts-art");
  const row = () => list.querySelector(`[data-id="${kKeyId}"]`);
  await TestUtils.waitForCondition(row, "The shortcuts are listed");
  const capRects = () =>
    [...art.querySelectorAll(".zen-settings-art-key")]
      .map(key => key.getBoundingClientRect())
      .filter(rect => rect.width);
  const fullSize = parseFloat(
    win.getComputedStyle(art).getPropertyValue("--zen-settings-art-key-size")
  );

  /**
   * Checks the key caps as they are drawn: all on one line, each one square,
   * and none sticking out of the panel.
   *
   * @param {number} count How many keys are expected.
   * @param {string} what What is being shown, for the messages.
   * @returns {number} The width of a key cap.
   */
  const checkCaps = (count, what) => {
    const rects = capRects();
    const artRect = art.getBoundingClientRect();
    is(rects.length, count, `${what}: ${count} key caps are shown`);
    ok(
      rects.every(rect => Math.abs(rect.top - rects[0].top) < 1),
      `${what}: the key caps are on one line`
    );
    ok(
      rects.every(rect => Math.abs(rect.width - rect.height) < 1),
      `${what}: every key cap is square`
    );
    ok(
      rects.every(rect => Math.abs(rect.width - rects[0].width) < 1),
      `${what}: the key caps are the same size`
    );
    Assert.lessOrEqual(
      rects.at(-1).right,
      artRect.right + 1,
      `${what}: the last key cap stays inside the panel`
    );
    return rects[0].width;
  };

  is(checkCaps(2, "Default art"), fullSize, "Two key caps are full size");

  CustomKeys.changeKey(kKeyId, { modifiers: "accel", key: "Y" });
  win.gZenSettingsWindow.showPane("shortcuts");
  await TestUtils.waitForCondition(
    () => row()?.hasAttribute("data-customized"),
    "The list shows the two-key shortcut"
  );
  row().querySelector(".zen-settings-shortcut-label").click();
  is(checkCaps(2, "Two keys"), fullSize, "A short shortcut is full size");

  CustomKeys.changeKey(kKeyId, {
    modifiers: "accel,alt,control,shift",
    key: "Y",
  });
  win.gZenSettingsWindow.showPane("shortcuts");
  await TestUtils.waitForCondition(
    () => capRects().length == 5,
    "The art shows the five-key shortcut"
  );
  const shrunk = checkCaps(5, "Five keys");
  Assert.less(shrunk, fullSize, "Many key caps shrink to fit");
  const label = art.querySelector("[data-key] > span");
  Assert.less(
    parseFloat(win.getComputedStyle(label).fontSize),
    shrunk,
    "The text on a key cap shrinks with it"
  );

  CustomKeys.resetKey(kKeyId);
  await BrowserTestUtils.closeWindow(win);
});
