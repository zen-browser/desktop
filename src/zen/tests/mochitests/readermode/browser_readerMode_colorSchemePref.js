/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const TEST_PATH = getRootDirectory(gTestPath).replace(
  "chrome://mochitests/content",
  "http://example.com"
);

async function testColorScheme(aPref, aExpectation) {
  // Set the browser content theme to light or dark.
  Services.prefs.setIntPref("browser.theme.content-theme", aPref);

  // Reader Mode Color Scheme Preference must be manually set by the user, will
  // default to "auto" initially.
  Services.prefs.setCharPref("reader.color_scheme", aExpectation);

  let aBodyExpectation = aExpectation;
  if (aBodyExpectation === "auto") {
    aBodyExpectation = aPref === 1 ? "light" : "dark";
  }

  // Open a browser tab, enter reader mode, and test if we have the valid
  // reader mode color scheme preference pre-selected.
  await BrowserTestUtils.withNewTab(
    TEST_PATH + "readerModeArticle.html",
    async function (browser) {
      let pageShownPromise = BrowserTestUtils.waitForContentEvent(
        browser,
        "AboutReaderContentReady"
      );

      let readerButton = document.getElementById("reader-mode-button");
      readerButton.click();
      await pageShownPromise;

      let colorScheme = Services.prefs.getCharPref("reader.color_scheme");

      Assert.equal(colorScheme, aExpectation);

      await SpecialPowers.spawn(browser, [aBodyExpectation], expectation => {
        let bodyClass = content.document.body.className;
        ok(
          bodyClass.includes(expectation),
          "The body of the test document has the correct color scheme."
        );
      });
    }
  );
}

/**
 * Test that opening reader mode maintains the correct color scheme preference
 * until the user manually sets a different color scheme.
 */
add_task(async function () {
  await testColorScheme(0, "auto");
  await testColorScheme(1, "auto");
  await testColorScheme(0, "light");
  await testColorScheme(1, "light");
  await testColorScheme(0, "dark");
  await testColorScheme(1, "dark");
  await testColorScheme(0, "sepia");
  await testColorScheme(1, "sepia");
});

async function testColorsFocus() {
  // Set the theme selection to auto.
  Services.prefs.setCharPref("reader.color_scheme", "auto");

  // Open a browser tab, enter reader mode, and test if focus stays
  // within the menu for the Default tab.
  await BrowserTestUtils.withNewTab(
    TEST_PATH + "readerModeArticle.html",
    async function (browser) {
      let pageShownPromise = BrowserTestUtils.waitForContentEvent(
        browser,
        "AboutReaderContentReady"
      );

      let readerButton = document.getElementById("reader-mode-button");
      readerButton.click();
      await pageShownPromise;

      await SpecialPowers.spawn(browser, [], () => {
        let doc = content.document;
        doc.querySelector(".colors-button").click();

        let defaultTab = doc.querySelector("#tabs-deck-button-fxtheme");
        let themeButton = doc.querySelector(".auto-button");
        themeButton.focus();

        EventUtils.synthesizeKey("KEY_Tab", {}, content);
        is(
          doc.activeElement,
          defaultTab,
          "Focus moves back to the Default tab"
        );

        let themeInput = doc.querySelector("#radio-itemauto-button");
        defaultTab.focus();
        EventUtils.synthesizeKey("KEY_Tab", { shiftKey: true }, content);
        is(doc.activeElement, themeInput, "Focus moves to selected theme");
      });
    }
  );

  // Set the theme selection to custom.
  Services.prefs.setCharPref("reader.color_scheme", "custom");

  // Open a browser tab, enter reader mode, and test if focus stays
  // within the menu for the Custom tab.
  await BrowserTestUtils.withNewTab(
    TEST_PATH + "readerModeArticle.html",
    async function (browser) {
      let pageShownPromise = BrowserTestUtils.waitForContentEvent(
        browser,
        "AboutReaderContentReady"
      );

      let readerButton = document.getElementById("reader-mode-button");
      readerButton.click();
      await pageShownPromise;

      await SpecialPowers.spawn(browser, [], async () => {
        let doc = content.document;
        const Event = content.Event;
        doc.querySelector(".colors-button").click();

        let customTab = doc.querySelector("#tabs-deck-button-customtheme");
        let resetButton = doc.querySelector(".custom-colors-reset-button");

        ok(
          ContentTaskUtils.isHidden(resetButton),
          "Reset button should be hidden to start with"
        );

        // Simulate changing a color to make the reset button visible.
        let colorInput = doc.querySelector("moz-input-color");
        let shadowRoot = colorInput.shadowRoot;
        let input = shadowRoot.querySelector("input");
        input.value = "#123456";
        input.dispatchEvent(
          new Event("input", { bubbles: true, composed: true })
        );

        // Wait for the reset button to become visible.
        await ContentTaskUtils.waitForCondition(() => {
          return resetButton.hidden === false;
        }, "Reset Defaults button should be visible after a color change.");

        resetButton.focus();

        EventUtils.synthesizeKey("KEY_Tab", {}, content);
        is(doc.activeElement, customTab, "Focus moves back to the Custom tab");

        customTab.focus();
        EventUtils.synthesizeKey("KEY_Tab", { shiftKey: true }, content);
        is(doc.activeElement, resetButton, "Focus moves to Reset theme button");
      });
    }
  );
}

/**
 * Test that the focus stays within the colors menu.
 */
add_task(async function () {
  await testColorsFocus();
});
