/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const { ZenHomepage, isValidHttpURL } = ChromeUtils.importESModule(
  "resource:///modules/zen/homepage/ZenHomepage.sys.mjs"
);

const CARD_PREFS = [
  "zen.homepage.cards.time-spent",
  "zen.homepage.cards.top-site",
  "zen.homepage.cards.network-speed",
  "zen.homepage.cards.downloads",
  "zen.homepage.cards.visited-sites",
  "zen.homepage.cards.version",
  "zen.homepage.cards.clock",
];

add_setup(async function () {
  await gZenWorkspaces.promiseInitialized;
  gZenHomepage?.init();
  registerCleanupFunction(async () => {
    Services.prefs.clearUserPref("zen.homepage.mode");
    Services.prefs.clearUserPref("zen.homepage.url");
    for (const pref of CARD_PREFS) {
      Services.prefs.clearUserPref(pref);
    }
    gZenHomepage?.sync();
  });
});

add_task(async function test_builtin_homepage_overlay_and_styles() {
  Services.prefs.setStringPref("zen.homepage.mode", "builtin");
  const emptyTab = gZenWorkspaces._emptyTab;
  ok(emptyTab, "Empty tab exists");
  gBrowser.selectedTab = emptyTab;
  gZenHomepage.sync();

  const homepage = document.getElementById("zen-homepage");
  ok(homepage, "Homepage overlay exists");
  ok(!homepage.hidden, "Built-in homepage is visible on the empty tab");

  const welcome = homepage.querySelector(".zen-homepage-welcome");
  is(
    getComputedStyle(welcome).fontSize,
    "60px",
    "Welcome text uses the 60px Cal Sans size"
  );

  const card = homepage.querySelector(".zen-homepage-card");
  const cardStyle = getComputedStyle(card);
  ok(
    cardStyle.borderRadius === "20px" ||
      cardStyle.borderTopLeftRadius === "20px",
    `Cards use a 20px corner radius, got ${cardStyle.borderRadius}`
  );
  const blur = `${cardStyle.backdropFilter} ${cardStyle.webkitBackdropFilter || ""}`;
  ok(blur.includes("blur"), `Cards use a background blur, got ${blur}`);
  ok(
    cardStyle.backgroundColor.includes("0.2") ||
      cardStyle.backgroundColor.includes("20%"),
    `Card fill is 20% white, got ${cardStyle.backgroundColor}`
  );

  const clock = homepage.querySelector(".zen-homepage-clock");
  is(
    getComputedStyle(clock).fontSize,
    "60px",
    "Clock keeps the 60px Cal Sans size"
  );

  const cardValue = homepage.querySelector(
    ".zen-homepage-card .zen-homepage-card-value"
  );
  is(
    getComputedStyle(cardValue).fontSize,
    "40px",
    "Stat card values use the smaller 40px size"
  );
  ok(
    parseFloat(getComputedStyle(cardValue).fontSize) <
      parseFloat(getComputedStyle(clock).fontSize),
    "Stat card values are smaller than the clock"
  );
  is(
    cardStyle.minHeight,
    "120px",
    "Stat cards use the 120px minimum height"
  );
});

add_task(async function test_homepage_live_data_updates() {
  Services.prefs.setStringPref("zen.homepage.mode", "builtin");
  gBrowser.selectedTab = gZenWorkspaces._emptyTab;
  gZenHomepage.sync();

  const homepage = document.getElementById("zen-homepage");
  ok(!homepage.hidden, "Homepage is visible for live updates");

  const clock = homepage.querySelector(".zen-homepage-clock");
  ok(clock.textContent.length > 0, "Clock shows a time after sync");
  ok(
    /\d/.test(clock.textContent),
    `Clock text looks like a time, got ${clock.textContent}`
  );

  const downloadsValue = homepage.querySelector(
    '[data-card="downloads"] .zen-homepage-card-value'
  );
  downloadsValue.textContent = "stale-test-marker";
  gZenHomepage.sync();
  await TestUtils.waitForCondition(
    () => downloadsValue.textContent !== "stale-test-marker",
    "Downloads card value is refreshed after sync"
  );

  const timeSpent = homepage.querySelector(
    '[data-card="time-spent"] .zen-homepage-card-value'
  );
  ok(timeSpent.textContent.length > 0, "Time spent card shows a duration");
});

add_task(async function test_card_pref_hides_card() {
  Services.prefs.setBoolPref("zen.homepage.cards.version", false);
  gZenHomepage.sync();
  const card = document.querySelector('#zen-homepage [data-card="version"]');
  ok(card.hidden, "Version card is hidden when its pref is off");
  Services.prefs.setBoolPref("zen.homepage.cards.version", true);
  gZenHomepage.sync();
  ok(!card.hidden, "Version card returns when its pref is on");
});

add_task(async function test_blank_mode_hides_overlay() {
  Services.prefs.setStringPref("zen.homepage.mode", "blank");
  gBrowser.selectedTab = gZenWorkspaces._emptyTab;
  gZenHomepage.sync();
  ok(
    document.getElementById("zen-homepage").hidden,
    "Nothing mode hides the built-in homepage"
  );
  is(
    ZenHomepage.getEmptyTabFallbackURL(),
    "about:blank",
    "Blank mode falls back to about:blank"
  );
});

add_task(async function test_custom_url_loads_in_empty_tab() {
  ok(isValidHttpURL("https://example.com/"), "https URLs are accepted");
  ok(!isValidHttpURL("ftp://example.com/"), "Non-http URLs are rejected");

  const browser = gZenWorkspaces._emptyTab.linkedBrowser;
  const loaded = BrowserTestUtils.browserLoaded(browser);
  Services.prefs.setStringPref("zen.homepage.url", "https://example.com/");
  Services.prefs.setStringPref("zen.homepage.mode", "custom");
  gZenHomepage.sync();
  await loaded;
  ok(
    browser.currentURI.spec.startsWith("https://example.com"),
    `Empty tab loaded the custom URL, got ${browser.currentURI.spec}`
  );

  ok(
    document.getElementById("zen-homepage").hidden,
    "Custom URL mode hides the built-in overlay"
  );
  is(
    ZenHomepage.getEmptyTabFallbackURL(),
    "https://example.com/",
    "Custom mode uses the validated homepage URL"
  );
  ok(
    gZenWorkspaces._emptyTab.hasAttribute("zen-empty-tab"),
    "The empty tab keeps its placeholder attribute"
  );
});
