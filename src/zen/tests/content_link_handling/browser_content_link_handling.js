/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_task(function test_default_link_shortcuts() {
  const defaults = Services.prefs.getDefaultBranch("");
  Assert.equal(defaults.getStringPref("zen.content-link-handling.glance-activation-method"), "none");
  Assert.equal(
    defaults.getStringPref("zen.content-link-handling.split-activation-method"),
    "none",
  );
});

for (const [glanceEnabled, glanceModifier, splitModifier] of [
  [true, "ctrl", "alt"],
  [true, "alt", "none"],
  [false, "none", "alt"],
]) {
  for (const inFrame of [false, true]) {
    add_task(async function test_alt_click_link() {
      await SpecialPowers.pushPrefEnv({
        set: [
          ["zen.glance.enabled", glanceEnabled],
          ["zen.content-link-handling.tab-activation-method", "none"],
          ["zen.content-link-handling.split-activation-method", splitModifier],
          ["zen.content-link-handling.glance-activation-method", glanceModifier],
        ],
      });
      const source = await addTabTo(gBrowser);
      gBrowser.selectedTab = source;
      const originalURL = source.linkedBrowser.currentURI.spec;
      const destination = "https://example.com/";
      const expectGlance = glanceEnabled && glanceModifier === "alt";
      let newTab;
      try {
        await SpecialPowers.spawn(
          source.linkedBrowser,
          [inFrame, destination],
          async (useFrame, url) => {
            let doc = content.document;
            doc.body.replaceChildren();
            if (useFrame) {
              const frame = doc.createElement("iframe");
              const loaded = new Promise((resolve) => (frame.onload = resolve));
              frame.srcdoc = "<!doctype html><body></body>";
              doc.body.append(frame);
              await loaded;
              doc = frame.contentDocument;
            }
            const link = doc.createElement("a");
            link.href = url;
            link.innerHTML =
              '<span id="split-link">Open beside this tab</span>';
            doc.body.append(link);
          },
        );
        const context = inFrame
          ? source.linkedBrowser.browsingContext.children[0]
          : source.linkedBrowser.browsingContext;
        const opened = BrowserTestUtils.waitForNewTab(gBrowser, destination);
        const split = expectGlance
          ? null
          : BrowserTestUtils.waitForEvent(
              window,
              "ZenViewSplitter:SplitViewActivated",
            );
        await BrowserTestUtils.synthesizeMouseAtCenter(
          "#split-link",
          { altKey: true },
          context,
        );
        newTab = await opened;
        await split;
        Assert.equal(
          source.linkedBrowser.currentURI.spec,
          originalURL,
          "The source page stays open",
        );
        if (expectGlance) {
          ok(
            newTab.hasAttribute("zen-glance-tab"),
            "The configured Glance shortcut opens a preview",
          );
          ok(!source.splitView, "The source tab was not split");
        } else {
          Assert.equal(
            source.group,
            newTab.group,
            "Both tabs share a split group",
          );
          ok(
            source.group.hasAttribute("split-view-group"),
            "The group is a split view",
          );
          Assert.equal(
            gBrowser.selectedTab,
            newTab,
            "The new split pane is focused",
          );
          ok(
            !newTab.hasAttribute("zen-glance-tab"),
            "Alt-click opens a split when Glance does not use the modifier",
          );
        }
      } finally {
        if (newTab?.hasAttribute("zen-glance-tab")) {
          await gZenGlanceManager.closeGlance({ onTabClose: true });
        } else if (newTab) {
          await BrowserTestUtils.removeTab(newTab);
        }
        await BrowserTestUtils.removeTab(source);
        await SpecialPowers.popPrefEnv();
      }
    });
  }
}

add_task(async function test_live_glance_preferences() {
  const source = await addTabTo(gBrowser);
  gBrowser.selectedTab = source;
  const originalSplit = gZenViewSplitter.openLinkInSplit;
  const originalGlance = gZenGlanceManager.openGlance;
  let action;
  gZenViewSplitter.openLinkInSplit = () => {
    action = "split";
  };
  gZenGlanceManager.openGlance = () => {
    action = "glance";
  };
  try {
    await SpecialPowers.spawn(source.linkedBrowser, [], () => {
      content.document.body.innerHTML =
        '<a id="link" href="https://example.com/">Link</a>';
    });
    for (const [enabled, modifier, splitModifier, clickModifier, expected] of [
      [true, "shift", "alt", "alt", "split"],
      [true, "alt", "none", "alt", "glance"],
      [false, "none", "alt", "alt", "split"],
      [true, "shift", "ctrl", "ctrl", "split"],
      [true, "shift", "alt", "shift", "glance"],
      [true, "shift", "none", "shift", "glance"],
      [true, "alt", "none", "alt", "glance"],
    ]) {
      await SpecialPowers.pushPrefEnv({
        set: [
          ["zen.glance.enabled", enabled],
          ["zen.content-link-handling.tab-activation-method", "none"],
          ["zen.content-link-handling.window-activation-method", "none"],
          ["zen.content-link-handling.glance-activation-method", modifier],
          ["zen.content-link-handling.split-activation-method", splitModifier],
        ],
      });
      try {
        action = null;
        await BrowserTestUtils.synthesizeMouseAtCenter(
          "#link",
          { [`${clickModifier}Key`]: true },
          source.linkedBrowser,
        );
        await TestUtils.waitForCondition(
          () => action !== null,
          "The modified click reaches the parent",
        );
        Assert.equal(
          action,
          expected,
          "Preference changes take effect without reloading the page",
        );
      } finally {
        await SpecialPowers.popPrefEnv();
      }
    }
  } finally {
    gZenViewSplitter.openLinkInSplit = originalSplit;
    gZenGlanceManager.openGlance = originalGlance;
    await BrowserTestUtils.removeTab(source);
  }
});

add_task(async function test_native_actions_and_reassignment() {
  await SpecialPowers.pushPrefEnv({
    set: [
      ["zen.content-link-handling.glance-activation-method", "none"],
      ["zen.content-link-handling.split-activation-method", "none"],
      ["zen.content-link-handling.tab-activation-method", "alt"],
      ["zen.content-link-handling.window-activation-method", "ctrl+shift"],
    ],
  });
  const source = await addTabTo(gBrowser);
  gBrowser.selectedTab = source;
  const destination = "https://example.com/";
  try {
    await SpecialPowers.spawn(source.linkedBrowser, [destination], (url) => {
      content.document.body.innerHTML = `<a id="link" href="${url}">Link</a>`;
    });
    const opened = BrowserTestUtils.waitForNewTab(gBrowser, destination);
    await BrowserTestUtils.synthesizeMouseAtCenter(
      "#link",
      { altKey: true },
      source.linkedBrowser,
    );
    const tab = await opened;
    ok(
      !tab.hasAttribute("zen-glance-tab") && !tab.splitView,
      "Remapped shortcut opens a normal tab",
    );
    await BrowserTestUtils.removeTab(tab);
    gBrowser.selectedTab = source;
    const windowOpened = BrowserTestUtils.waitForNewWindow({
      url: destination,
    });
    await BrowserTestUtils.synthesizeMouseAtCenter(
      "#link",
      { ctrlKey: true, shiftKey: true },
      source.linkedBrowser,
    );
    const newWindow = await windowOpened;
    ok(newWindow !== window, "Combination opens a new window");
    await BrowserTestUtils.closeWindow(newWindow);
    gBrowser.selectedTab = source;
    const loaded = BrowserTestUtils.browserLoaded(
      source.linkedBrowser,
      false,
      destination,
    );
    await BrowserTestUtils.synthesizeMouseAtCenter(
      "#link",
      { shiftKey: true },
      source.linkedBrowser,
    );
    await loaded;
    is(
      source.linkedBrowser.currentURI.spec,
      destination,
      "Old new-window shortcut no longer opens a window",
    );
  } finally {
    await BrowserTestUtils.removeTab(source);
    await SpecialPowers.popPrefEnv();
  }
});

add_task(async function test_conflicting_preferences() {
  const { ContentLinkHandling } = ChromeUtils.importESModule(
    "resource:///actors/ContentLinkHandling.sys.mjs",
  );
  await SpecialPowers.pushPrefEnv({
    set: [
      ["zen.content-link-handling.glance-activation-method", "alt"],
      ["zen.content-link-handling.split-activation-method", "alt"],
    ],
  });
  try {
    is(
      ContentLinkHandling.resolve("alt"),
      "conflict",
      "A collision never silently selects a winner",
    );
    is(
      ContentLinkHandling.resolve("none"),
      null,
      "Off never intercepts an ordinary click",
    );
    is(
      ContentLinkHandling.shortcut({ ctrlKey: true, altKey: true }),
      "ctrl+alt",
      "Combinations match exactly",
    );
  } finally {
    await SpecialPowers.popPrefEnv();
  }
});

add_task(async function test_settings_live_changes_and_collisions() {
  await SpecialPowers.pushPrefEnv({
    set: [
      ["zen.content-link-handling.glance-activation-method", "none"],
      ["zen.content-link-handling.split-activation-method", "alt"],
      ["zen.content-link-handling.tab-activation-method", "ctrl"],
      ["zen.content-link-handling.window-activation-method", "shift"],
    ],
  });
  const tab = await BrowserTestUtils.openNewForegroundTab(
    gBrowser,
    "about:preferences#zenLooks",
  );
  try {
    const win = tab.linkedBrowser.contentWindow;
    await TestUtils.waitForCondition(
      () => win.gZenContentLinkHandling?.config,
      "Shortcut settings initialized",
    );
    const settings = win.gZenContentLinkHandling;
    ok(
      !win.document.getElementById("zenLooksAndFeelGlanceEnabled"),
      "No redundant Glance checkbox",
    );
    const glance = settings.config.actions[0];
    const input = settings.fields.get("glance").input;
    input.focus();
    const key = (type, name, modifiers = {}) => input.dispatchEvent(new win.KeyboardEvent(type, {
      key: name, bubbles: true, cancelable: true, ...modifiers,
    }));
    key("keydown", "Control", { ctrlKey: true });
    key("keydown", "Alt", { ctrlKey: true, altKey: true });
    key("keyup", "Alt", { ctrlKey: true });
    is(Services.prefs.getStringPref(glance.pref), "none", "Recording waits until all modifiers are released");
    key("keyup", "Control");
    await settings.observe();
    is(
      Services.prefs.getStringPref(glance.pref),
      "ctrl+alt",
      "Settings changes take effect without a restart dialog",
    );
    await settings.change(glance, "alt");
    ok(!settings.fields.get("glance").conflict.hidden, "Conflicts appear inline");
    await settings.cancel();
    is(
      Services.prefs.getStringPref(glance.pref),
      "ctrl+alt",
      "Cancel preserves the original shortcut",
    );
    await settings.change(glance, "alt");
    await settings.swap();
    is(
      Services.prefs.getStringPref(glance.pref),
      "alt",
      "Swap assigns the requested shortcut",
    );
    is(
      Services.prefs.getStringPref(settings.config.actions[1].pref),
      "ctrl+alt",
      "Swap moves the previous shortcut to the conflicting action",
    );
    input.focus();
    key("keydown", "Shift", { shiftKey: true });
    key("keydown", "Escape", { shiftKey: true });
    is(Services.prefs.getStringPref(glance.pref), "alt", "Escape discards the recording");
    input.focus();
    key("keydown", "Control", { ctrlKey: true });
    key("keydown", "a", { ctrlKey: true });
    key("keyup", "a", { ctrlKey: true });
    key("keyup", "Control");
    is(Services.prefs.getStringPref(glance.pref), "alt", "Ordinary keys cannot create a modifier shortcut");
    key("keydown", "Backspace");
    is(Services.prefs.getStringPref(glance.pref), "none", "Backspace disables the shortcut");
    key("keydown", "Shift", { shiftKey: true });
    input.blur();
    key("keyup", "Shift");
    is(Services.prefs.getStringPref(glance.pref), "none", "Leaving the field cancels recording");
  } finally {
    await BrowserTestUtils.removeTab(tab);
    await SpecialPowers.popPrefEnv();
  }
});
