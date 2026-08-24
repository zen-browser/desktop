/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_task(async function test_emoji_search_filters_rendered_buttons() {
  const panel = document.getElementById("PanelUI-zen-emojis-picker");
  const anchor = document.getElementById("PanelUI-menu-button");
  const popupShown = BrowserTestUtils.waitForEvent(panel, "popupshown");
  const pickerPromise = gZenEmojiPicker.open(anchor);
  const pickerRejected = Assert.rejects(
    pickerPromise,
    /Emoji picker closed without selection/,
    "Closing without a selection should reject the picker promise"
  );

  try {
    await popupShown;

    const buttons = [...gZenEmojiPicker.emojiList.children];
    const rocketButton = buttons.find(
      button => button.getAttribute("label") === "🚀"
    );
    const grinningButton = buttons.find(
      button => button.getAttribute("label") === "😀"
    );
    const searchInput = gZenEmojiPicker.searchInput;

    Assert.ok(rocketButton, "The picker should render the rocket emoji");
    Assert.ok(grinningButton, "The picker should render the grinning emoji");

    searchInput.value = "rocket";
    searchInput.dispatchEvent(new Event("input", { bubbles: true }));

    Assert.ok(!rocketButton.hidden, "A matching emoji should remain visible");
    Assert.ok(grinningButton.hidden, "A non-matching emoji should be hidden");

    searchInput.value = "";
    searchInput.dispatchEvent(new Event("input", { bubbles: true }));

    Assert.ok(
      buttons.every(button => !button.hidden),
      "Clearing the search should show every emoji again"
    );
  } finally {
    if (panel.state !== "closed") {
      const popupHidden = BrowserTestUtils.waitForEvent(panel, "popuphidden");
      panel.hidePopup();
      await popupHidden;
    }

    await pickerRejected;
  }
});
