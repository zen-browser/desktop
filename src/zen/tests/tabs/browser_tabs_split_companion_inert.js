/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const COMPANION_PREFS = [
  "zen.splitCompanion.enabled",
  "zen.splitCompanion.pane.visible",
  "zen.splitCompanion.rightWeb.visible",
];

async function setCompanionPrefs(enabled, paneVisible, rightWebVisible) {
  await SpecialPowers.pushPrefEnv({
    set: [
      ["zen.splitCompanion.enabled", enabled],
      ["zen.splitCompanion.pane.visible", paneVisible],
      ["zen.splitCompanion.rightWeb.visible", rightWebVisible],
    ],
  });
}

function nextCompanionRefreshFrame() {
  return new Promise(resolve => requestAnimationFrame(resolve));
}

add_task(async function test_Split_Companion_Default_Startup_Inert() {
  for (const id of [
    "tabbrowser-tabs",
    "tabbrowser-arrowscrollbox",
    "zen-tabs-wrapper",
    "tabbrowser-tabbox",
    "zen-split-companion-pane",
  ]) {
    is(
      document.querySelectorAll(`#${id}`).length,
      1,
      `${id} should be unique at startup`
    );
  }

  for (const pref of COMPANION_PREFS) {
    is(Services.prefs.getBoolPref(pref), false, `${pref} should default false`);
  }

  const companionPane = document.getElementById("zen-split-companion-pane");
  ok(window.gZenSplitCompanionPane, "Companion pane module should initialize");
  ok(companionPane.hidden, "Companion pane should be hidden by default");
  is(
    getComputedStyle(companionPane).display,
    "none",
    "Companion pane should not be visible by default"
  );

  let pushedPrefEnvs = 0;
  async function pushCompanionPrefs(enabled, paneVisible, rightWebVisible) {
    await setCompanionPrefs(enabled, paneVisible, rightWebVisible);
    pushedPrefEnvs++;
  }

  async function restoreCompanionDefaults() {
    while (pushedPrefEnvs > 0) {
      await SpecialPowers.popPrefEnv();
      pushedPrefEnvs--;
    }

    window.gZenSplitCompanionPane.destroy();
    window.gZenSplitCompanionPane.init();
  }

  registerCleanupFunction(restoreCompanionDefaults);

  try {
    await pushCompanionPrefs(true, true, true);
    ok(
      !companionPane.hidden,
      "Production-initialized companion pane should show after startup pref changes"
    );
    await nextCompanionRefreshFrame();
    ok(
      companionPane.querySelector(".zen-split-companion-render"),
      "Production-initialized companion pane should render after startup pref changes"
    );

    await pushCompanionPrefs(false, false, false);
    ok(
      companionPane.hidden,
      "Production-initialized companion pane should hide after startup prefs reset"
    );

    window.gZenSplitCompanionPane.init();
    window.gZenSplitCompanionPane.init();
    window.gZenSplitCompanionPane.destroy();
    await pushCompanionPrefs(true, true, true);
    ok(
      companionPane.hidden,
      "Destroyed companion pane should not react after repeated init"
    );
    ok(
      !companionPane.hasAttribute("zen-split-companion-enabled"),
      "Destroyed companion pane should not leak enabled observers"
    );
    ok(
      !companionPane.hasAttribute("zen-split-companion-pane-visible"),
      "Destroyed companion pane should not leak pane visibility observers"
    );
    ok(
      !companionPane.hasAttribute("zen-split-companion-right-web-visible"),
      "Destroyed companion pane should not leak right web visibility observers"
    );

    window.gZenSplitCompanionPane.init();
    ok(
      !companionPane.hidden,
      "Companion pane should show when enabled and visible"
    );
    ok(
      companionPane.hasAttribute("zen-split-companion-enabled"),
      "Companion pane should mirror the enabled pref"
    );
    ok(
      companionPane.hasAttribute("zen-split-companion-pane-visible"),
      "Companion pane should mirror the pane visibility pref"
    );
    ok(
      companionPane.hasAttribute("zen-split-companion-right-web-visible"),
      "Companion pane should mirror the right web visibility pref"
    );

    await nextCompanionRefreshFrame();
    ok(
      companionPane.querySelector(".zen-split-companion-render"),
      "Visible companion pane should have rendered content before destroy"
    );
    ok(
      window.gZenSplitCompanionPane.snapshot,
      "Visible companion pane should expose a snapshot before destroy"
    );

    window.gZenSplitCompanionPane.destroy();
    ok(
      companionPane.hidden,
      "Destroying a visible companion pane should leave the host hidden"
    );
    ok(
      !companionPane.hasAttribute("zen-split-companion-enabled"),
      "Destroying a visible companion pane should clear the enabled attribute"
    );
    ok(
      !companionPane.hasAttribute("zen-split-companion-pane-visible"),
      "Destroying a visible companion pane should clear the pane visibility attribute"
    );
    ok(
      !companionPane.hasAttribute("zen-split-companion-right-web-visible"),
      "Destroying a visible companion pane should clear the right web visibility attribute"
    );
    ok(
      !companionPane.querySelector(".zen-split-companion-render"),
      "Destroying a visible companion pane should clear rendered content"
    );
    is(
      window.gZenSplitCompanionPane.snapshot,
      null,
      "Destroying a visible companion pane should clear the public snapshot getter"
    );

    window.gZenSplitCompanionPane.init();
    ok(
      !companionPane.hidden,
      "Companion pane should show again after reinitializing with visible prefs"
    );

    await pushCompanionPrefs(false, false, false);
    ok(companionPane.hidden, "Companion pane should hide when disabled");
    ok(
      !companionPane.hasAttribute("zen-split-companion-enabled"),
      "Companion pane should clear the enabled attribute when disabled"
    );
    ok(
      !companionPane.hasAttribute("zen-split-companion-pane-visible"),
      "Companion pane should clear the pane visibility attribute"
    );
    ok(
      !companionPane.hasAttribute("zen-split-companion-right-web-visible"),
      "Companion pane should clear the right web visibility attribute"
    );
  } finally {
    await restoreCompanionDefaults();
  }

  ok(companionPane.hidden, "Companion pane should restore hidden default state");
});

add_task(async function test_Split_Companion_Right_Web_Pref_Delegates_To_Split_View_API() {
  const companionPane = window.gZenSplitCompanionPane;
  const companionHost = document.getElementById("zen-split-companion-pane");
  const originalSplitter = window.gZenViewSplitter;
  const calls = [];
  let pushedPrefEnvs = 0;

  try {
    companionPane.destroy();
    window.gZenViewSplitter = {
      setRightSplitWebVisible(visible, options) {
        calls.push({ visible, options });
        if (visible) {
          return { ok: false, reason: "missing-active-split" };
        }
        return { ok: true, action: "hidden" };
      },
    };

    await setCompanionPrefs(true, true, false);
    pushedPrefEnvs++;
    companionPane.init();

    is(calls.length, 1, "Initializing should sync the right web pref once");
    is(
      calls[0].visible,
      false,
      "The companion pane should request hidden right web state"
    );
    ok(
      calls[0].options?.source === "split-companion-pref",
      "The companion pane should identify the pref bridge as the request source"
    );
    ok(
      !companionHost.hasAttribute("zen-split-companion-right-web-visible"),
      "The host should continue to mirror the right web visibility pref"
    );
    ok(
      !companionHost.hasAttribute("data-zen-right-web-visibility-failed"),
      "Successful bridge calls should not leave a failure marker"
    );

    await SpecialPowers.pushPrefEnv({
      set: [["zen.splitCompanion.rightWeb.visible", true]],
    });
    pushedPrefEnvs++;
    is(calls.length, 2, "Changing the right web pref should call the API");
    is(
      calls[1].visible,
      true,
      "The companion pane should request visible right web state"
    );
    ok(
      companionHost.hasAttribute("zen-split-companion-right-web-visible"),
      "The host should mirror the updated right web visibility pref"
    );
    ok(
      !companionHost.hasAttribute("data-zen-right-web-visibility-failed"),
      "Missing active split should not be recorded as a host failure"
    );
    ok(
      !companionHost.hasAttribute("data-zen-right-web-visibility-error"),
      "Missing active split should not leave a structured failure reason"
    );
  } finally {
    companionPane.destroy();
    while (pushedPrefEnvs > 0) {
      await SpecialPowers.popPrefEnv();
      pushedPrefEnvs--;
    }
    window.gZenViewSplitter = originalSplitter;
    companionPane.init();
  }
});
