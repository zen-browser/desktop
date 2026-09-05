/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_task(function test_default_link_shortcuts() {
  const defaults = Services.prefs.getDefaultBranch("");
  Assert.equal(defaults.getStringPref("zen.glance.activation-method"), "shift");
  Assert.equal(
    defaults.getStringPref("zen.content-link-handling.split-activation-method"),
    "alt"
  );
});

for (const [glanceEnabled, glanceModifier] of [
  [true, "ctrl"],
  [true, "alt"],
  [false, "alt"],
]) {
  for (const inFrame of [false, true]) {
    add_task(async function test_alt_click_link() {
      await SpecialPowers.pushPrefEnv({
        set: [
          ["zen.glance.enabled", glanceEnabled],
          ["zen.content-link-handling.split-activation-method", "alt"],
          ["zen.glance.activation-method", glanceModifier],
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
              const loaded = new Promise(resolve => (frame.onload = resolve));
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
          }
        );
        const context = inFrame
          ? source.linkedBrowser.browsingContext.children[0]
          : source.linkedBrowser.browsingContext;
        const opened = BrowserTestUtils.waitForNewTab(gBrowser, destination);
        const split = expectGlance
          ? null
          : BrowserTestUtils.waitForEvent(
              window,
              "ZenViewSplitter:SplitViewActivated"
            );
        await BrowserTestUtils.synthesizeMouseAtCenter(
          "#split-link",
          { altKey: true },
          context
        );
        newTab = await opened;
        await split;
        Assert.equal(
          source.linkedBrowser.currentURI.spec,
          originalURL,
          "The source page stays open"
        );
        if (expectGlance) {
          ok(
            newTab.hasAttribute("zen-glance-tab"),
            "The configured Glance shortcut wins the collision"
          );
          ok(!source.splitView, "The source tab was not split");
        } else {
          Assert.equal(
            source.group,
            newTab.group,
            "Both tabs share a split group"
          );
          ok(
            source.group.hasAttribute("split-view-group"),
            "The group is a split view"
          );
          Assert.equal(
            gBrowser.selectedTab,
            newTab,
            "The new split pane is focused"
          );
          ok(
            !newTab.hasAttribute("zen-glance-tab"),
            "Alt-click opens a split when Glance does not use the modifier"
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
      [true, "alt", "alt", "alt", "glance"],
      [false, "alt", "alt", "alt", "split"],
      [true, "shift", "ctrl", "ctrl", "split"],
      [true, "shift", "alt", "shift", "glance"],
      [true, "shift", "none", "shift", "glance"],
      [true, "alt", "alt", "alt", "glance"],
    ]) {
      await SpecialPowers.pushPrefEnv({
        set: [
          ["zen.glance.enabled", enabled],
          ["zen.glance.activation-method", modifier],
          ["zen.content-link-handling.split-activation-method", splitModifier],
        ],
      });
      try {
        action = null;
        await BrowserTestUtils.synthesizeMouseAtCenter(
          "#link",
          { [`${clickModifier}Key`]: true },
          source.linkedBrowser
        );
        await TestUtils.waitForCondition(
          () => action !== null,
          "The modified click reaches the parent"
        );
        Assert.equal(
          action,
          expected,
          "Preference changes take effect without reloading the page"
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
