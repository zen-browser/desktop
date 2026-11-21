/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_task(async function test_icon_picker_search() {
  const panel = document.getElementById("PanelUI-zen-emojis-picker");
  const input = gZenEmojiPicker.searchInput;
  const visible = list => Array.from(list.children).filter(item => !item.hidden);
  const search = value => {
    input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
  };

  for (const onlySvgIcons of [false, true]) {
    const shown = BrowserTestUtils.waitForEvent(panel, "popupshown");
    let selected;
    const result = gZenEmojiPicker
      .open(gBrowser.selectedTab.iconImage, {
        onlySvgIcons,
        closeOnSelect: false,
        onSelect: icon => {
          selected = icon;
        },
      })
      .catch(() => null);
    await shown;
    try {
      ok(
        BrowserTestUtils.isVisible(input),
        "Search is visible in both picker modes"
      );
      is(document.activeElement, input, "Search receives focus");
      if (!onlySvgIcons) {
        search("happy");
        ok(
          visible(gZenEmojiPicker.emojiList).length > 0,
          "Emoji tags are searchable"
        );
        document
          .getElementById("PanelUI-zen-emojis-picker-change-svg")
          .doCommand();
      }
      const iconRects = Array.from(gZenEmojiPicker.svgList.children).map(
        item => item.getBoundingClientRect()
      );
      const firstRow = iconRects[0];
      const secondRow = iconRects.find(rect => rect.top > firstRow.top + 1);
      ok(secondRow, "Icons span multiple rows");
      const rowGap = parseFloat(
        getComputedStyle(gZenEmojiPicker.svgList).rowGap
      );
      if (secondRow) {
        isfuzzy(
          secondRow.top - firstRow.bottom,
          rowGap,
          1,
          "Icon rows keep their normal spacing"
        );
      }
      search("gaming");
      const taggedIcon = visible(gZenEmojiPicker.svgList).find(
        item => item.getAttribute("icon") === "game-controller.svg"
      );
      ok(taggedIcon, "Icons are searchable by their tags");
      search("briefcase");
      const icon = visible(gZenEmojiPicker.svgList).find(
        item => item.getAttribute("icon") === "briefcase.svg"
      );
      ok(icon, "Icons are searchable by name");
      is(
        icon.getAttribute("tooltiptext"),
        "Briefcase",
        "Icons use a readable name as their label"
      );
      const image = new Image();
      image.src = gZenEmojiPicker.getSVGURL(icon.getAttribute("icon"));
      await image.decode();
      ok(image.naturalWidth > 0, "Selectable SVG loads");
      icon.doCommand();
      is(selected, image.src, "Selection returns the icon URL");
      search("no-matching-icon-12345");
      is(
        visible(gZenEmojiPicker.svgList).length,
        0,
        "Unmatched icons are hidden"
      );
      search("");
      is(
        visible(gZenEmojiPicker.svgList).length,
        86,
        "Clearing search restores all icons"
      );
    } finally {
      const hidden = BrowserTestUtils.waitForEvent(panel, "popuphidden");
      panel.hidePopup();
      await hidden;
      await result;
    }
  }
});
