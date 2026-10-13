/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const PREF_ENABLED = "zen.underpowered.enabled";
const PREF_SAVED = "zen.underpowered.saved-prefs";
const TUNED_PREF = "image.animation_mode";
const FOOT_BUTTONS = "zen-sidebar-foot-buttons";

function button() {
  return document.getElementById("zen-underpowered-button");
}

function isFrozen(tab) {
  return tab.hasAttribute("pending") && !tab.linkedPanel;
}

async function openLoadedTab(url, { selected }) {
  if (selected) {
    return BrowserTestUtils.openNewForegroundTab(gBrowser, url);
  }
  const tab = BrowserTestUtils.addTab(gBrowser, url);
  await BrowserTestUtils.browserLoaded(tab.linkedBrowser, false, url);
  return tab;
}

function setUnderpowered(enabled) {
  const node = button();
  is(
    node.getAttribute("aria-pressed"),
    String(!enabled),
    "The button shows the state it is about to leave"
  );
  node.doCommand();
  is(
    Services.prefs.getBoolPref(PREF_ENABLED),
    enabled,
    "The button toggles the pref"
  );
}

add_task(async function test_button_sits_after_ghost_mode() {
  const placement = CustomizableUI.getPlacementOfWidget(
    "zen-underpowered-button"
  );
  is(placement?.area, FOOT_BUTTONS, "The button is in the sidebar foot");
  const ghost = CustomizableUI.getPlacementOfWidget("zen-ghost-mode-button");
  if (ghost?.area === FOOT_BUTTONS) {
    is(
      placement.position,
      ghost.position + 1,
      "The button sits right after Ghost mode"
    );
  }
  ok(button(), "The button is in the window");
  ok(!button().hasAttribute("checked"), "The button starts unchecked");
});

add_task(async function test_freeze_switch_and_restore() {
  const originalMode = Services.prefs.getStringPref(TUNED_PREF);
  const hadUserValue = Services.prefs.prefHasUserValue(TUNED_PREF);

  const unloadedBefore = await openLoadedTab("https://example.com/?before", {
    selected: false,
  });
  await gBrowser.prepareDiscardBrowser(unloadedBefore);
  ok(gBrowser.discardBrowser(unloadedBefore), "The first tab is unloaded");
  const background = await openLoadedTab("https://example.org/", {
    selected: false,
  });
  const selected = await openLoadedTab("https://example.com/?selected", {
    selected: true,
  });
  ok(isFrozen(unloadedBefore), "The first tab starts unloaded");
  ok(!isFrozen(background), "The background tab starts loaded");

  registerCleanupFunction(() => {
    Services.prefs.clearUserPref(PREF_ENABLED);
    for (const tab of [unloadedBefore, background, selected]) {
      if (!tab.closing && tab.isConnected) {
        BrowserTestUtils.removeTab(tab);
      }
    }
  });

  setUnderpowered(true);
  ok(button().hasAttribute("checked"), "The button is checked");
  ok(
    document.documentElement.hasAttribute("zen-underpowered"),
    "The window is marked underpowered"
  );
  is(Services.prefs.getStringPref(TUNED_PREF), "none", "The pref is tuned");
  ok(
    Services.prefs.prefHasUserValue(PREF_SAVED),
    "The original prefs are saved"
  );

  await TestUtils.waitForCondition(
    () => isFrozen(background),
    "The background tab is frozen"
  );
  ok(!isFrozen(selected), "The selected tab stays loaded");

  await BrowserTestUtils.switchTab(gBrowser, background);
  await TestUtils.waitForCondition(
    () => !isFrozen(background) && !background.hasAttribute("busy"),
    "The tab switched to comes back"
  );
  await TestUtils.waitForCondition(
    () => isFrozen(selected),
    "The tab left behind is frozen"
  );
  ok(!isFrozen(background), "The newly selected tab stays loaded");

  setUnderpowered(false);
  ok(!button().hasAttribute("checked"), "The button is unchecked");
  ok(
    !document.documentElement.hasAttribute("zen-underpowered"),
    "The window is no longer marked underpowered"
  );
  is(
    Services.prefs.getStringPref(TUNED_PREF),
    originalMode,
    "The tuned pref is restored"
  );
  is(
    Services.prefs.prefHasUserValue(TUNED_PREF),
    hadUserValue,
    "The pref is back on the branch it came from"
  );
  ok(
    !Services.prefs.prefHasUserValue(PREF_SAVED),
    "The saved prefs are cleared"
  );

  await TestUtils.waitForCondition(
    () => !isFrozen(selected),
    "The frozen tab is loaded again without being visited"
  );
  await TestUtils.waitForCondition(
    () =>
      selected.linkedBrowser.currentURI.spec ===
      "https://example.com/?selected",
    "The frozen tab comes back to its page"
  );
  ok(isFrozen(unloadedBefore), "A tab unloaded before stays unloaded");
});
