/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_task(async function test_slider_changes_tab_volume() {
  const tab = await addMediaTab();
  await BrowserTestUtils.switchTab(gBrowser, tab);

  try {
    await openSiteDataPanel();

    const item = document.getElementById("zen-site-data-volume");
    const valueLabel = document.getElementById("zen-site-data-volume-value");
    ok(!item.hidden, "the volume row is shown for a web page");
    is(volumeSlider().getAttribute("aria-valuenow"), "100", "starts at 100%");
    is(volumeSlider().getAttribute("aria-valuemax"), "300", "boosts to 300%");

    dragVolumeSlider(150);
    assertVolumeNear(tab, 1.5, "dragging the slider sets the tab volume");
    const volume = gZenTabVolume.getVolume(tab);
    is(
      tab.linkedBrowser.browsingContext.zenMediaVolume,
      Math.fround(volume),
      "the volume is set on the tab's browsing context"
    );
    await waitForPlaybackVolume(tab, volume);
    await TestUtils.waitForCondition(
      () => valueLabel.textContent === `${Math.round(volume * 100)}%`,
      "the row shows the new volume"
    );

    dragVolumeSlider(40);
    assertVolumeNear(tab, 0.4, "the slider also lowers the volume");
    await waitForPlaybackVolume(tab, gZenTabVolume.getVolume(tab));
  } finally {
    await closeSiteDataPanel();
    BrowserTestUtils.removeTab(tab);
    await clearSiteVolumes();
  }
});

add_task(async function test_dragging_keeps_page_focused() {
  const tab = await addMediaTab();
  await BrowserTestUtils.switchTab(gBrowser, tab);
  tab.linkedBrowser.focus();
  await SpecialPowers.spawn(tab.linkedBrowser, [], () => {
    content.wrappedJSObject.blurred = false;
    content.addEventListener("blur", () => {
      content.wrappedJSObject.blurred = true;
    });
  });

  try {
    await openSiteDataPanel();
    dragVolumeSlider(200);
    assertVolumeNear(tab, 2, "dragging changed the volume");
    ok(
      !(await SpecialPowers.spawn(
        tab.linkedBrowser,
        [],
        () => content.wrappedJSObject.blurred
      )),
      "the page keeps focus while the slider is dragged"
    );
  } finally {
    await closeSiteDataPanel();
    BrowserTestUtils.removeTab(tab);
    await clearSiteVolumes();
  }
});

add_task(async function test_wheel_and_snapping() {
  const tab = await addMediaTab();
  await BrowserTestUtils.switchTab(gBrowser, tab);

  try {
    await openSiteDataPanel();
    scrollVolumeSlider(1);
    is(gZenTabVolume.getVolume(tab), 0.95, "scrolling down lowers by 5%");
    scrollVolumeSlider(-1);
    scrollVolumeSlider(-1);
    is(gZenTabVolume.getVolume(tab), 1.05, "scrolling up raises by 5%");

    gZenTabVolume.setVolume(tab, 0.97);
    scrollVolumeSlider(-1);
    is(gZenTabVolume.getVolume(tab), 1, "values close to 100% snap to it");
  } finally {
    await closeSiteDataPanel();
    BrowserTestUtils.removeTab(tab);
    await clearSiteVolumes();
  }
});

add_task(async function test_wheel_stores_the_last_value() {
  const tab = await addMediaTab();
  await BrowserTestUtils.switchTab(gBrowser, tab);

  try {
    await openSiteDataPanel();
    for (let i = 0; i < 4; i++) {
      scrollVolumeSlider(-1);
    }
    is(gZenTabVolume.getVolume(tab), 1.2, "four steps up");
    await TestUtils.waitForCondition(
      async () => (await getStoredSiteVolume(tab)) === 1.2,
      "the site volume is stored once scrolling stops"
    );
  } finally {
    await closeSiteDataPanel();
    BrowserTestUtils.removeTab(tab);
    await clearSiteVolumes();
  }
});

add_task(async function test_keyboard() {
  const tab = await addMediaTab();
  await BrowserTestUtils.switchTab(gBrowser, tab);

  try {
    await openSiteDataPanel();
    volumeSlider().focus();
    is(document.activeElement, volumeSlider(), "the slider can be focused");

    EventUtils.synthesizeKey("KEY_ArrowRight");
    is(gZenTabVolume.getVolume(tab), 1.05, "right arrow raises by 5%");
    EventUtils.synthesizeKey("KEY_ArrowDown");
    EventUtils.synthesizeKey("KEY_ArrowDown");
    is(gZenTabVolume.getVolume(tab), 0.95, "down arrow lowers by 5%");
    EventUtils.synthesizeKey("KEY_PageUp");
    is(gZenTabVolume.getVolume(tab), 1.15, "page up raises by 20%");
    EventUtils.synthesizeKey("KEY_End");
    is(gZenTabVolume.getVolume(tab), 3, "end goes to the maximum");
    EventUtils.synthesizeKey("KEY_Home");
    is(gZenTabVolume.getVolume(tab), 0, "home goes to silence");
    document
      .getElementById("zen-site-data-volume-mute")
      .dispatchEvent(
        new KeyboardEvent("keydown", { key: "PageUp", bubbles: true })
      );
    is(gZenTabVolume.getVolume(tab), 0, "keys on the mute button are ignored");
  } finally {
    await closeSiteDataPanel();
    BrowserTestUtils.removeTab(tab);
    await clearSiteVolumes();
  }
});

add_task(async function test_double_click_resets_volume() {
  const tab = await addMediaTab();
  await BrowserTestUtils.switchTab(gBrowser, tab);

  try {
    await openSiteDataPanel();
    dragVolumeSlider(240);
    assertVolumeNear(tab, 2.4, "precondition: the tab is boosted");

    const slider = volumeSlider();
    const rect = slider.getBoundingClientRect();
    const x = rect.width * 0.8;
    const y = rect.height / 2;
    EventUtils.synthesizeMouse(slider, x, y, { clickCount: 1 });
    EventUtils.synthesizeMouse(slider, x, y, { clickCount: 2 });
    is(gZenTabVolume.getVolume(tab), 1, "double click resets to 100%");
    await waitForPlaybackVolume(tab, 1);
  } finally {
    await closeSiteDataPanel();
    BrowserTestUtils.removeTab(tab);
    await clearSiteVolumes();
  }
});

add_task(async function test_icon_follows_volume() {
  const tab = await addMediaTab();
  await BrowserTestUtils.switchTab(gBrowser, tab);

  try {
    await openSiteDataPanel();
    const icon = document.querySelector(".zen-site-data-volume-icon-strip");
    const frame = () =>
      Number(
        getComputedStyle(icon).getPropertyValue("--zen-volume-icon-frame")
      );
    is(icon.getAttribute("level"), "high", "the panel opens on the tab level");
    is(frame(), 36, "opening the panel doesn't animate the icon");

    for (const [volume, level, expectedFrame] of [
      [0, "muted", 0],
      [0.2, "low", 12],
      [0.5, "medium", 24],
      [1, "high", 36],
      [2.5, "boosted", 48],
    ]) {
      gZenTabVolume.setVolume(tab, volume);
      is(
        icon.getAttribute("level"),
        level,
        `the icon is ${level} at ${volume}`
      );
      await TestUtils.waitForCondition(
        () => frame() === expectedFrame,
        `the icon settles on frame ${expectedFrame}`
      );
    }

    tab.toggleMuteAudio();
    is(icon.getAttribute("level"), "muted", "muting the tab shows muted");
    tab.toggleMuteAudio();
    is(icon.getAttribute("level"), "boosted", "unmuting restores the level");
  } finally {
    await closeSiteDataPanel();
    BrowserTestUtils.removeTab(tab);
    await clearSiteVolumes();
  }
});
add_task(async function test_mute_button_and_slider() {
  const tab = await addMediaTab();
  await BrowserTestUtils.switchTab(gBrowser, tab);

  try {
    await openSiteDataPanel();

    const item = document.getElementById("zen-site-data-volume");
    const valueLabel = document.getElementById("zen-site-data-volume-value");
    const muteButton = document.getElementById("zen-site-data-volume-mute");

    muteButton.dispatchEvent(new Event("command", { bubbles: true }));
    ok(tab.muted, "the mute button mutes the tab");
    ok(item.hasAttribute("muted"), "the row reflects the muted state");
    await TestUtils.waitForCondition(
      () => valueLabel.textContent === "Muted",
      "the row says the tab is muted"
    );

    dragVolumeSlider(80);
    ok(!tab.muted, "moving the slider unmutes the tab");
    ok(!item.hasAttribute("muted"), "the row is no longer muted");
    await waitForPlaybackVolume(tab, gZenTabVolume.getVolume(tab));
  } finally {
    if (tab.muted) {
      tab.toggleMuteAudio();
    }
    await closeSiteDataPanel();
    BrowserTestUtils.removeTab(tab);
    await clearSiteVolumes();
  }
});

add_task(async function test_panel_follows_selected_tab() {
  const loud = await addMediaTab();
  const quiet = await addMediaTab();
  gZenTabVolume.setVolume(loud, 2);
  gZenTabVolume.setVolume(quiet, 0.5);
  await BrowserTestUtils.switchTab(gBrowser, loud);

  try {
    await openSiteDataPanel();
    is(
      volumeSlider().getAttribute("aria-valuenow"),
      "200",
      "the slider shows the selected tab volume"
    );

    await BrowserTestUtils.switchTab(gBrowser, quiet);
    is(
      volumeSlider().getAttribute("aria-valuenow"),
      "50",
      "the slider follows the newly selected tab"
    );

    dragVolumeSlider(70);
    assertVolumeNear(quiet, 0.7, "the selected tab changes");
    is(gZenTabVolume.getVolume(loud), 2, "the previous tab is left alone");
  } finally {
    await closeSiteDataPanel();
    BrowserTestUtils.removeTab(loud);
    BrowserTestUtils.removeTab(quiet);
    await clearSiteVolumes();
  }
});
