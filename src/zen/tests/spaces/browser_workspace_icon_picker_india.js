/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_task(async function test_workspace_picker_india_curated() {
  const panel = document.getElementById("PanelUI-zen-emojis-picker");
  ok(panel, "Emoji picker panel should exist.");

  const anchor = document.createXULElement("toolbarbutton");
  document.getElementById("navigator-toolbox").appendChild(anchor);
  registerCleanupFunction(() => {
    anchor.remove();
  });

  const shown = BrowserTestUtils.waitForEvent(panel, "popupshown");
  const openResult = gZenEmojiPicker.open(anchor, { closeOnSelect: false });
  ok(openResult, "Picker should open and return a promise.");
  await shown;

  ok(
    document.getElementById("PanelUI-zen-emojis-picker-category-selector"),
    "India category selector should be rendered."
  );

  const rupeeIconButton = panel.querySelector(
    '#PanelUI-zen-emojis-picker-svgs toolbarbutton[icon="rupee-india.svg"]'
  );
  ok(rupeeIconButton, "India rupee icon should be present.");

  const oldUsdIconButton = panel.querySelector(
    '#PanelUI-zen-emojis-picker-svgs toolbarbutton[icon="logo-usd.svg"]'
  );
  ok(!oldUsdIconButton, "Non-India generic picker icon should not be present.");

  EventUtils.synthesizeMouseAtCenter(
    document.getElementById("PanelUI-zen-emojis-picker-category-festivals"),
    {},
    window
  );
  await TestUtils.waitForCondition(
    () => rupeeIconButton.hidden,
    "Festival category should hide non-festival icons."
  );

  EventUtils.synthesizeMouseAtCenter(
    document.getElementById("PanelUI-zen-emojis-picker-category-all"),
    {},
    window
  );
  const search = document.getElementById("PanelUI-zen-emojis-picker-search");
  search.value = "rupee";
  search.dispatchEvent(new Event("input", { bubbles: true }));
  await TestUtils.waitForCondition(
    () => !rupeeIconButton.hidden,
    "Search should find the rupee icon by tag/label."
  );

  ok(gZenEmojiPicker.isValidWorkspaceIcon("🇮🇳"), "India emoji should be accepted.");
  ok(!gZenEmojiPicker.isValidWorkspaceIcon("😀"), "Non-curated emoji should be rejected.");
  ok(
    gZenEmojiPicker.isValidWorkspaceIcon(gZenEmojiPicker.getSVGURL("rupee-india.svg")),
    "India curated SVG URL should be accepted."
  );
  ok(
    !gZenEmojiPicker.isValidWorkspaceIcon(
      gZenEmojiPicker.getSVGURL("logo-usd.svg")
    ),
    "Non-curated SVG URL should be rejected."
  );

  const hidden = BrowserTestUtils.waitForEvent(panel, "popuphidden");
  panel.hidePopup();
  await hidden;
});
