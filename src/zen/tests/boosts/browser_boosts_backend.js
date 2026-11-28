/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const { gZenBoostsManager } = ChromeUtils.importESModule(
  "resource:///modules/zen/boosts/ZenBoostsManager.sys.mjs"
);

const DOMAIN = "example.com";
const PAGE = "https://example.com/";
const OTHER_PAGE = "https://example.org/";

let gBoost;

function bodyStyle(browser, property) {
  return SpecialPowers.spawn(
    browser,
    [property],
    prop => content.getComputedStyle(content.document.body)[prop]
  );
}

function updateBoost(changes) {
  Object.assign(gBoost.boostEntry.boostData, changes);
  gZenBoostsManager.updateBoost(gBoost);
}

add_setup(async function () {
  gBoost = gZenBoostsManager.createNewBoost(DOMAIN);
  Object.assign(gBoost.boostEntry.boostData, {
    changeWasMade: true,
    enableColorBoost: true,
    smartInvert: true,
    customCSS: "body { text-indent: 7px !important; }",
  });
  gZenBoostsManager.makeBoostActiveForDomain(DOMAIN, gBoost.id);

  registerCleanupFunction(() => {
    gZenBoostsManager.deleteBoost(gBoost);
  });
});

add_task(async function test_boost_applies_on_load() {
  await BrowserTestUtils.withNewTab(PAGE, async browser => {
    const bc = browser.browsingContext;
    await TestUtils.waitForCondition(
      () => bc.zenBoostsData !== 0,
      "The accent should be set on the page's BrowsingContext"
    );
    ok(bc.isZenBoostsInverted, "The inversion flag should be set");
    Assert.equal(
      bc.zenBoostsComplementaryRotation,
      gBoost.boostEntry.boostData.secondaryDotAngleDegDelta,
      "The complementary rotation should come from the boost"
    );
    await TestUtils.waitForCondition(
      async () => (await bodyStyle(browser, "textIndent")) === "7px",
      "The boost's custom CSS should style the page"
    );
  });
});

add_task(async function test_boost_follows_edits() {
  await BrowserTestUtils.withNewTab(PAGE, async browser => {
    const bc = browser.browsingContext;
    await TestUtils.waitForCondition(
      async () => (await bodyStyle(browser, "textIndent")) === "7px",
      "The boost's custom CSS should style the page"
    );

    updateBoost({
      enableColorBoost: false,
      smartInvert: false,
      customCSS: "body { text-indent: 9px !important; }",
      textCaseOverride: "uppercase",
    });
    Assert.equal(bc.zenBoostsData, 0, "The accent should be cleared");
    ok(!bc.isZenBoostsInverted, "The inversion flag should be cleared");
    await TestUtils.waitForCondition(
      async () => (await bodyStyle(browser, "textIndent")) === "9px",
      "The new custom CSS should replace the old one"
    );

    updateBoost({ customCSS: "", textCaseOverride: "none" });
    await TestUtils.waitForCondition(
      async () => (await bodyStyle(browser, "textIndent")) === "0px",
      "Removing the custom CSS should unload the stylesheet"
    );

    updateBoost({
      enableColorBoost: true,
      smartInvert: true,
      customCSS: "body { text-indent: 7px !important; }",
    });
  });
});

add_task(async function test_slider_values_stored_as_strings() {
  await BrowserTestUtils.withNewTab(PAGE, async browser => {
    const bc = browser.browsingContext;
    const original = { ...gBoost.boostEntry.boostData };
    const values = { contrast: 0.9, brightness: 0.8, saturation: 0.7 };

    updateBoost(values);
    const expected = bc.zenBoostsData;
    updateBoost({ contrast: 0, brightness: 0, saturation: 0 });
    Assert.notEqual(
      bc.zenBoostsData,
      expected,
      "The sliders should change the accent"
    );

    updateBoost({
      contrast: String(values.contrast),
      brightness: String(values.brightness),
      saturation: String(values.saturation),
    });
    Assert.equal(
      bc.zenBoostsData,
      expected,
      "String slider values should be read like numbers"
    );

    updateBoost({
      contrast: original.contrast,
      brightness: original.brightness,
      saturation: original.saturation,
    });
  });
});

add_task(async function test_boost_survives_same_site_navigation() {
  await BrowserTestUtils.withNewTab(PAGE, async browser => {
    await TestUtils.waitForCondition(
      async () => (await bodyStyle(browser, "textIndent")) === "7px",
      "The boost's custom CSS should style the page"
    );

    BrowserTestUtils.startLoadingURIString(browser, PAGE + "?second");
    await BrowserTestUtils.browserLoaded(browser);
    await TestUtils.waitForCondition(
      async () => (await bodyStyle(browser, "textIndent")) === "7px",
      "The stylesheet should be attached to the new document too"
    );
  });
});

add_task(async function test_boost_is_removed_when_leaving_the_domain() {
  await BrowserTestUtils.withNewTab(PAGE, async browser => {
    await TestUtils.waitForCondition(
      () => browser.browsingContext.zenBoostsData !== 0,
      "The accent should be set on the boosted page"
    );

    BrowserTestUtils.startLoadingURIString(browser, OTHER_PAGE);
    await BrowserTestUtils.browserLoaded(browser);
    const bc = browser.browsingContext;
    await TestUtils.waitForCondition(
      () => bc.zenBoostsData === 0 && !bc.isZenBoostsInverted,
      "The boost should not follow the tab to another domain"
    );
    Assert.equal(
      await bodyStyle(browser, "textIndent"),
      "0px",
      "The boost's stylesheet should not style another domain"
    );
  });
});

add_task(async function test_boost_is_removed_when_deactivated() {
  await BrowserTestUtils.withNewTab(PAGE, async browser => {
    const bc = browser.browsingContext;
    await TestUtils.waitForCondition(
      () => bc.zenBoostsData !== 0,
      "The accent should be set on the boosted page"
    );

    gZenBoostsManager.toggleBoostActiveForDomain(DOMAIN, gBoost.id);
    Assert.equal(bc.zenBoostsData, 0, "The accent should be cleared");
    await TestUtils.waitForCondition(
      async () => (await bodyStyle(browser, "textIndent")) === "0px",
      "The stylesheet should be unloaded"
    );

    gZenBoostsManager.toggleBoostActiveForDomain(DOMAIN, gBoost.id);
    await TestUtils.waitForCondition(
      () => bc.zenBoostsData !== 0,
      "Reactivating the boost should apply it again"
    );
  });
});
