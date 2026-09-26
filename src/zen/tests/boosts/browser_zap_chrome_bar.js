/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const { gZenBoostsManager } = ChromeUtils.importESModule(
  "resource:///modules/zen/boosts/ZenBoostsManager.sys.mjs"
);

const TEST_DOMAIN = "example.com";
const TEST_URL =
  getRootDirectory(gTestPath).replace(
    "chrome://mochitests/content",
    "https://example.com"
  ) + "file_zap_chrome_bar.html";

function zapActor(browser) {
  return browser.browsingContext.currentWindowGlobal.getActor("ZenBoosts");
}

function zapBarFor(browser) {
  return browser.parentNode.parentNode.querySelector(":scope > .zen-zap-bar");
}

function isZapBarVisible(browser) {
  const bar = zapBarFor(browser);
  return !!bar && !bar.hidden && bar.getBoundingClientRect().height > 0;
}

function unzapButtons(browser) {
  return [
    ...(zapBarFor(browser)?.querySelectorAll(".zen-zap-bar-unzap") ?? []),
  ];
}

function isZapEnabled(browser) {
  return zapActor(browser).sendQuery("ZenBoost:ZapModeEnabled");
}

function zapSelectors() {
  return gZenBoostsManager.loadActiveBoostFromStore(TEST_DOMAIN).boostEntry
    .boostData.zapSelectors;
}

function contentInnerHeight(browser) {
  return SpecialPowers.spawn(browser, [], () => content.innerHeight);
}

async function startZap(browser) {
  await zapActor(browser).sendQuery("ZenBoost:ToggleZapMode");
  await TestUtils.waitForCondition(
    async () => isZapBarVisible(browser) && (await isZapEnabled(browser)),
    "Zap bar is shown and the page is zapping"
  );
  await waitForRepaint(browser);
}

async function waitForZapStopped(browser) {
  await TestUtils.waitForCondition(
    async () => !isZapBarVisible(browser) && !(await isZapEnabled(browser)),
    "Zap bar is hidden and the page stopped zapping"
  );
}

async function pressDone(browser) {
  const done = zapBarFor(browser).querySelector(".zen-zap-bar-done");
  EventUtils.synthesizeMouseAtCenter(done, {}, window);
  await waitForZapStopped(browser);
}

/**
 * Returns the centre of an element inside the page's anonymous content.
 */
function anonymousElementCenter(browser, id) {
  return SpecialPowers.spawn(browser, [id], async elementId => {
    const doc = content.document;
    const containers = InspectorUtils.getChildrenForNode(
      doc.documentElement,
      true,
      false
    );
    const hosts = containers.flatMap(node => [
      ...(node.querySelectorAll?.(".anonymous-content-host") ?? []),
    ]);
    for (const node of hosts) {
      const element = node.openOrClosedShadowRoot?.getElementById(elementId);
      if (!element) {
        continue;
      }
      if (content.getComputedStyle(element).visibility !== "visible") {
        return null;
      }
      await new Promise(resolve => content.requestAnimationFrame(resolve));
      await Promise.all(
        element
          .closest("#select-component")
          .getAnimations()
          .map(animation => animation.finished)
      );
      const rect = element.getBoundingClientRect();
      if (!rect.width || !rect.height) {
        return null;
      }
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    }
    return null;
  });
}

function hasAnonymousElement(browser, id) {
  return SpecialPowers.spawn(browser, [id], elementId => {
    return InspectorUtils.getChildrenForNode(
      content.document.documentElement,
      true,
      false
    ).some(container =>
      [...(container.querySelectorAll?.(".anonymous-content-host") ?? [])].some(
        node => !!node.openOrClosedShadowRoot?.getElementById(elementId)
      )
    );
  });
}

async function zapBottomTarget(browser) {
  await BrowserTestUtils.synthesizeMouseAtCenter("#bottom", {}, browser);

  let point = null;
  await TestUtils.waitForCondition(async () => {
    point = await anonymousElementCenter(browser, "select-this");
    return point;
  }, "Selection controls appear for the fixed-bottom target");
  await waitForRepaint(browser);
  point = await anonymousElementCenter(browser, "select-this");

  await BrowserTestUtils.synthesizeMouseAtPoint(point.x, point.y, {}, browser);
  await TestUtils.waitForCondition(
    () => unzapButtons(browser).length === 1,
    "The chrome bar lists the new Zap"
  );
}

function isBottomTargetHidden(browser) {
  return SpecialPowers.spawn(browser, [], () => {
    const target = content.document.getElementById("bottom");
    return content.getComputedStyle(target).display === "none";
  });
}

async function pageReceivesClick(browser) {
  const clicked = BrowserTestUtils.waitForContentEvent(browser, "click");
  await BrowserTestUtils.synthesizeMouseAtCenter("#filler", {}, browser);
  return (await clicked) === "click";
}

async function withTestTab(callback) {
  const tab = await BrowserTestUtils.openNewForegroundTab(gBrowser, TEST_URL);
  try {
    await callback(tab.linkedBrowser, tab);
  } finally {
    if (tab.linkedBrowser && (await isZapEnabled(tab.linkedBrowser))) {
      await zapActor(tab.linkedBrowser).sendQuery("ZenBoost:DisableZapMode");
    }
    BrowserTestUtils.removeTab(tab);
    gZenBoostsManager.clearZapSelectorsForActive(TEST_DOMAIN);
  }
}

add_setup(async function () {
  await SpecialPowers.pushPrefEnv({
    set: [
      ["zen.boosts.enabled", true],
      ["zen.boosts.dissolve-on-zap", false],
    ],
  });
  const boost = gZenBoostsManager.createNewBoost(TEST_DOMAIN);
  boost.boostEntry.boostData.changeWasMade = true;
  gZenBoostsManager.makeBoostActiveForDomain(TEST_DOMAIN, boost.id);
  registerCleanupFunction(() => gZenBoostsManager.deleteBoost(boost));
});

add_task(async function test_bar_takes_viewport_height_and_zaps_bottom() {
  await withTestTab(async browser => {
    const baseline = await contentInnerHeight(browser);

    await startZap(browser);
    const barHeight = zapBarFor(browser).getBoundingClientRect().height;
    await TestUtils.waitForCondition(
      async () => (await contentInnerHeight(browser)) < baseline,
      "The page viewport shrinks while the bar is shown"
    );
    Assert.lessOrEqual(
      Math.abs(baseline - (await contentInnerHeight(browser)) - barHeight),
      1,
      "The viewport shrinks by the bar's row height"
    );

    await zapBottomTarget(browser);
    await TestUtils.waitForCondition(
      () => isBottomTargetHidden(browser),
      "The fixed-bottom target is zapped"
    );
    Assert.equal(zapSelectors().length, 1, "The Zap is saved to the Boost");
    ok(isZapBarVisible(browser), "The bar stays in place after zapping");

    await pressDone(browser);
    await TestUtils.waitForCondition(
      async () => (await contentInnerHeight(browser)) === baseline,
      "Done restores the viewport height"
    );
    ok(await pageReceivesClick(browser), "Page input works after Done");
  });
});

add_task(async function test_preview_and_unzap() {
  await SpecialPowers.pushPrefEnv({
    set: [["zen.boosts.dissolve-on-zap", true]],
  });
  try {
    await withTestTab(async browser => {
      const isPreviewing = () =>
        SpecialPowers.spawn(browser, [], () =>
          content.document
            .getElementById("bottom")
            .hasAttribute("zen-zap-unhide")
        );

      await startZap(browser);
      await zapBottomTarget(browser);
      ok(
        await hasAnonymousElement(browser, "zen-zap-dissolve-canvas"),
        "Zapping with animation creates the dissolve effect"
      );
      const [button] = unzapButtons(browser);

      EventUtils.synthesizeMouseAtCenter(button, { type: "mousemove" }, window);
      await TestUtils.waitForCondition(isPreviewing, "Hover previews the Zap");
      const done = zapBarFor(browser).querySelector(".zen-zap-bar-done");
      EventUtils.synthesizeMouseAtCenter(done, { type: "mousemove" }, window);
      await TestUtils.waitForCondition(
        async () => !(await isPreviewing()),
        "Leaving the button clears the preview"
      );

      button.focus();
      await TestUtils.waitForCondition(isPreviewing, "Focus previews the Zap");
      button.blur();
      await TestUtils.waitForCondition(
        async () => !(await isPreviewing()),
        "Blur clears the preview"
      );

      EventUtils.synthesizeMouseAtCenter(button, {}, window);
      await TestUtils.waitForCondition(
        () => !zapSelectors().length && !unzapButtons(browser).length,
        "Unzap removes the selector from the Boost and the bar"
      );
      ok(zapBarFor(browser).hasAttribute("empty"), "The empty helper is shown");
      await TestUtils.waitForCondition(
        async () => !(await isBottomTargetHidden(browser)),
        "The target is visible again"
      );
      ok(!(await isPreviewing()), "No preview remains after Unzap");

      await BrowserTestUtils.synthesizeMouseAtCenter("#bottom", {}, browser);
      await TestUtils.waitForCondition(
        () => anonymousElementCenter(browser, "select-this"),
        "Selection keeps working after Unzap"
      );

      await pressDone(browser);
      ok(
        !(await hasAnonymousElement(browser, "zen-zap-dissolve-canvas")),
        "Done removes the animation canvas"
      );
    });
  } finally {
    await SpecialPowers.popPrefEnv();
  }
});

add_task(async function test_find_and_zap_exclude_each_other() {
  await withTestTab(async (browser, tab) => {
    const findbar = await gBrowser.getFindBar(tab);
    findbar.onFindCommand();
    await TestUtils.waitForCondition(() => !findbar.hidden, "Find is open");
    await Promise.all(
      findbar.getAnimations().map(animation => animation.finished)
    );
    await waitForRepaint(browser);
    const findOnlyHeight = await contentInnerHeight(browser);

    await startZap(browser);
    ok(findbar.hidden, "Starting Zap closes Find in the same browser");

    findbar.onFindCommand();
    await waitForZapStopped(browser);
    ok(!findbar.hidden, "Find is open again");
    await TestUtils.waitForCondition(
      () => Services.focus.focusedElement === findbar._findField,
      "Find keeps focus after ending Zap"
    );
    await TestUtils.waitForCondition(
      async () => (await contentInnerHeight(browser)) === findOnlyHeight,
      "Only the Find row takes viewport height"
    );
    findbar.close(true);
  });

  await withTestTab(async (browser, tab) => {
    ok(!gBrowser.isFindBarInitialized(tab), "Find is not created yet");
    await startZap(browser);

    const findbar = await gBrowser.getFindBar(tab);
    findbar.onFindCommand();
    await waitForZapStopped(browser);
    ok(!findbar.hidden, "Lazily created Find opens and ends Zap");
    findbar.close(true);
  });

  await withTestTab(async (browser, tab) => {
    await startZap(browser);

    const otherTab = await BrowserTestUtils.openNewForegroundTab(
      gBrowser,
      TEST_URL
    );
    const otherFindbar = await gBrowser.getFindBar(otherTab);
    otherFindbar.onFindCommand();
    await TestUtils.waitForCondition(
      () => !otherFindbar.hidden,
      "Find opens in the other browser"
    );
    await BrowserTestUtils.switchTab(gBrowser, tab);
    BrowserTestUtils.removeTab(otherTab);
    ok(isZapBarVisible(browser), "The original browser keeps its Zap bar");
    ok(await isZapEnabled(browser), "The original page is still zapping");
    await pressDone(browser);
  });
});

add_task(async function test_lifecycle_and_stale_messages() {
  await withTestTab(async browser => {
    const actor = zapActor(browser);
    const toggles = [
      actor.sendQuery("ZenBoost:ToggleZapMode"),
      actor.sendQuery("ZenBoost:ToggleZapMode"),
    ];
    await Promise.all(toggles);
    await waitForZapStopped(browser);
    ok(
      !(await hasAnonymousElement(browser, "zap-border")),
      "A cancelled start does not attach the overlay"
    );
    ok(await pageReceivesClick(browser), "Page input works after cancel");
  });

  await withTestTab(async browser => {
    await startZap(browser);
    BrowserTestUtils.startLoadingURIString(browser, TEST_URL + "?next");
    await BrowserTestUtils.browserLoaded(browser);
    await waitForZapStopped(browser);

    const shown = BrowserTestUtils.waitForContentEvent(browser, "pageshow");
    browser.goBack();
    await shown;
    ok(!isZapBarVisible(browser), "Going back does not restart Zap");
    ok(!(await isZapEnabled(browser)), "The restored page is not zapping");
    ok(
      !(await hasAnonymousElement(browser, "zap-border")),
      "The restored page has no Zap overlay"
    );

    await startZap(browser);
    await SpecialPowers.spawn(browser, [], () => {
      const child = content.windowGlobalChild.getActor("ZenBoosts");
      child.sendAsyncMessage("ZenBoost:ZapListUpdate", {
        token: -1,
        zaps: [{ selector: "#filler", count: 1 }],
      });
      child.sendAsyncMessage("ZenBoost:ZapStop", { token: -1 });
    });
    // A query round trip ensures the stale messages above were handled.
    ok(await isZapEnabled(browser), "Stale messages do not stop the page");
    ok(isZapBarVisible(browser), "Stale stop does not hide the bar");
    Assert.equal(
      unzapButtons(browser).length,
      0,
      "Stale list update does not change the bar"
    );
  });

  const tab = await BrowserTestUtils.openNewForegroundTab(gBrowser, TEST_URL);
  await startZap(tab.linkedBrowser);
  const bar = zapBarFor(tab.linkedBrowser);
  BrowserTestUtils.removeTab(tab);
  ok(bar.hidden, "Closing the tab ends the Zap session");
  ok(!bar.isConnected, "Closing the tab removes the bar");
});
