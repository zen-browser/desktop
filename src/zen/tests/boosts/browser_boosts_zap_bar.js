/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const { gZenBoostsManager } = ChromeUtils.importESModule(
  "resource:///modules/zen/boosts/ZenBoostsManager.sys.mjs"
);

const DOMAIN = "example.com";
const PAGE = "https://example.com/";

function getZapBar(browser) {
  return browser.closest(".browserContainer")?.querySelector("zen-zap-bar");
}

function isFramed(browser) {
  return browser
    .closest(".browserSidebarContainer")
    .hasAttribute("zen-zapping");
}

function getUnzapButtons(bar) {
  return [...bar.shadowRoot.querySelectorAll(".zen-zap-bar-unzap")];
}

function getHelperL10nId(bar) {
  return bar.shadowRoot.querySelector(".zen-zap-bar-helper").dataset.l10nId;
}

function getDoneButton(bar) {
  return bar.shadowRoot.querySelector(".zen-zap-bar-done");
}

function getZapSelectors() {
  return gZenBoostsManager.loadActiveBoostFromStore(DOMAIN).boostEntry.boostData
    .zapSelectors;
}

function isBodyHidden(browser) {
  return SpecialPowers.spawn(
    browser,
    [],
    () => content.getComputedStyle(content.document.body).display === "none"
  );
}

function getActor(browser) {
  return browser.browsingContext.currentWindowGlobal.getActor("ZenBoosts");
}

async function enableZapMode(browser) {
  await getActor(browser).sendQuery("ZenBoost:ToggleZapMode");
  const bar = await BrowserTestUtils.waitForCondition(
    () => getZapBar(browser),
    "The zap bar should be inserted into the chrome"
  );
  await bar.updateComplete;
  return bar;
}

add_setup(async function () {
  const boost = gZenBoostsManager.createNewBoost(DOMAIN);
  boost.boostEntry.boostData.changeWasMade = true;
  gZenBoostsManager.makeBoostActiveForDomain(DOMAIN, boost.id);
  gZenBoostsManager.updateBoost(boost);

  registerCleanupFunction(() => {
    gZenBoostsManager.deleteBoost(boost);
  });
});

add_task(async function test_zap_bar_renders_in_chrome() {
  await BrowserTestUtils.withNewTab(PAGE, async browser => {
    const bar = await enableZapMode(browser);

    Assert.equal(
      bar.previousElementSibling,
      browser.parentNode,
      "The bar should sit right after the browser stack, like the find bar"
    );
    ok(isFramed(browser), "The browser is framed while zapping");
    Assert.equal(
      getUnzapButtons(bar).length,
      0,
      "There should be no unzap buttons without zaps"
    );
    Assert.equal(
      getHelperL10nId(bar),
      "zen-add-zap-helper",
      "The helper text should ask to zap elements"
    );

    gZenBoostsManager.addZapSelectorToActive("body", DOMAIN);
    await BrowserTestUtils.waitForCondition(
      () => getUnzapButtons(bar).length === 1,
      "An unzap button should appear for the new zap"
    );
    await BrowserTestUtils.waitForCondition(
      () => isBodyHidden(browser),
      "The zapped element should be hidden by the boost styles"
    );
    const [button] = getUnzapButtons(bar);
    Assert.equal(
      button.textContent.trim(),
      "1",
      "The button shows the zap index"
    );
    Assert.equal(
      getHelperL10nId(bar),
      "zen-remove-zap-helper",
      "The helper text should explain how to unzap"
    );

    EventUtils.synthesizeMouseAtCenter(button, { type: "mousemove" }, window);
    await BrowserTestUtils.waitForCondition(
      () =>
        SpecialPowers.spawn(browser, [], () =>
          content.document.body.hasAttribute("zen-zap-unhide")
        ),
      "Hovering the unzap button should reveal the zapped element"
    );
    await bar.updateComplete;
    Assert.equal(
      button.textContent.trim(),
      "×",
      "The hovered button offers removal"
    );

    EventUtils.synthesizeMouseAtCenter(
      getDoneButton(bar),
      { type: "mousemove" },
      window
    );
    await BrowserTestUtils.waitForCondition(
      async () =>
        !(await SpecialPowers.spawn(browser, [], () =>
          content.document.body.hasAttribute("zen-zap-unhide")
        )),
      "Leaving the unzap button should hide the zapped element again"
    );
    await bar.updateComplete;
    Assert.equal(button.textContent.trim(), "1", "The index is shown again");

    EventUtils.synthesizeMouseAtCenter(button, {}, window);
    await BrowserTestUtils.waitForCondition(
      () => getUnzapButtons(bar).length === 0,
      "Clicking the unzap button should remove the zap from the bar"
    );
    Assert.deepEqual(getZapSelectors(), [], "The zap was removed");
    await BrowserTestUtils.waitForCondition(
      async () => !(await isBodyHidden(browser)),
      "The unzapped element should be shown again by the updated styles"
    );

    EventUtils.synthesizeMouseAtCenter(getDoneButton(bar), {}, window);
    await BrowserTestUtils.waitForCondition(
      () => !getZapBar(browser),
      "Done should remove the bar"
    );
    ok(!isFramed(browser), "Done removes the frame too");
    Assert.equal(
      await getActor(browser).sendQuery("ZenBoost:ZapModeEnabled"),
      false,
      "Zap mode should be disabled"
    );
  });
});

add_task(async function test_zap_bar_hides_focus_entries() {
  await BrowserTestUtils.withNewTab(PAGE, async browser => {
    const bar = await enableZapMode(browser);

    gZenBoostsManager.addZapSelectorToActive("body", DOMAIN, "focus");
    gZenBoostsManager.addZapSelectorToActive("html", DOMAIN);
    await BrowserTestUtils.waitForCondition(
      () => getUnzapButtons(bar).length === 1,
      "Only the zap entry should get a button"
    );

    gZenBoostsManager.removeZapSelectorToActive("body", DOMAIN, "focus");
    gZenBoostsManager.removeZapSelectorToActive("html", DOMAIN);
    await BrowserTestUtils.waitForCondition(
      () => getUnzapButtons(bar).length === 0,
      "The zap entry is gone again"
    );

    await getActor(browser).sendQuery("ZenBoost:ToggleZapMode");
    await BrowserTestUtils.waitForCondition(() => !getZapBar(browser));
  });
});

add_task(async function test_zap_bar_removed_on_navigation() {
  await BrowserTestUtils.withNewTab(PAGE, async browser => {
    await enableZapMode(browser);

    BrowserTestUtils.startLoadingURIString(browser, PAGE + "?navigated");
    await BrowserTestUtils.browserLoaded(browser);

    await BrowserTestUtils.waitForCondition(
      () => !getZapBar(browser),
      "Navigating away should remove the bar"
    );
  });
});

add_task(async function test_zap_bar_closes_find_bar() {
  await BrowserTestUtils.withNewTab(PAGE, async browser => {
    const findBar = await gBrowser.getFindBar();
    findBar.open();
    ok(!findBar.hidden, "The find bar is open");

    await enableZapMode(browser);
    ok(findBar.hidden, "Opening the zap bar closes the find bar");

    await getActor(browser).sendQuery("ZenBoost:ToggleZapMode");
    await BrowserTestUtils.waitForCondition(
      () => !getZapBar(browser),
      "Toggling again removes the bar"
    );
  });
});
