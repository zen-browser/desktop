/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const TEST_PATH = getRootDirectory(gTestPath).replace(
  "chrome://mochitests/content",
  "https://example.com"
);

const defaultValues = {
  "font-family": "sans-serif",
  "font-weight": "normal",
  "content-width": "30em",
  "line-height": "1.6em",
  "letter-spacing": "0.00em",
  "word-spacing": "0.00em",
  "text-alignment": "start",
};

/**
 * Test that the layout and advanced layout pref selection updates
 * the document layout correctly.
 */
async function testTextLayout(aPref, value, cssProp, cssValue) {
  // Set the pref to the custom value.
  const valueType = typeof value;
  if (valueType == "number") {
    Services.prefs.setIntPref(`reader.${aPref}`, value);
  } else if (valueType == "string") {
    Services.prefs.setCharPref(`reader.${aPref}`, value);
  }

  // Open a browser tab, enter reader mode, and test if the page layout
  // reflects the pref selection.
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

      let customPref;
      if (valueType == "number") {
        customPref = Services.prefs.getIntPref(`reader.${aPref}`);
      } else if (valueType == "string") {
        customPref = Services.prefs.getCharPref(`reader.${aPref}`);
      }
      Assert.equal(customPref, value);

      await SpecialPowers.spawn(
        browser,
        [cssValue, cssProp],
        (expectedValue, prop) => {
          let container = content.document.querySelector(".container");
          let style = content.window.getComputedStyle(container);
          let actualValue = style.getPropertyValue(`--${prop}`);
          Assert.equal(actualValue, expectedValue);
        }
      );
    }
  );
}

/**
 * Test that the reset button restores all layout options to defaults.
 */
async function testTextLayoutReset() {
  // Set all prefs to non-default values.
  Services.prefs.setIntPref(`reader.font_size`, 15);
  Services.prefs.setCharPref(`reader.font_type`, "serif");
  Services.prefs.setCharPref(`reader.font_weight`, "bold");
  Services.prefs.setIntPref(`reader.content_width`, 6);
  Services.prefs.setIntPref(`reader.line_height`, 6);
  Services.prefs.setIntPref(`reader.character_spacing`, 3);
  Services.prefs.setIntPref(`reader.word_spacing`, 3);
  Services.prefs.setCharPref(`reader.text_alignment`, "left");

  // Open a browser tab, enter reader mode, and test if the reset button
  // restores the page layout to the default pref values.
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

      await SpecialPowers.spawn(
        browser,
        [Object.keys(defaultValues), defaultValues],
        (props, defaults) => {
          let resetButton = content.document.querySelector(
            ".text-layout-reset-button"
          );
          resetButton.click();
          let container = content.document.querySelector(".container");
          let style = content.window.getComputedStyle(container);

          for (let prop of props) {
            let resetValue = style.getPropertyValue(`--${prop}`);
            Assert.equal(resetValue, defaults[prop]);
          }

          // Cannot test font size because the font size reset happens asynchronously,
          // but we can check that font size buttons are re-enabled.
          let plusButton = content.document.querySelector(
            ".text-size-plus-button"
          );
          Assert.equal(plusButton.hasAttribute("disabled"), false);
        }
      );
    }
  );
}

/**
 * Test that the focus stays within the text and layout menu.
 */
async function testTextLayoutFocus() {
  // Open a browser tab, enter reader mode, and test if the focus stays
  // within the menu.
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
        doc.querySelector(".text-layout-button").click();

        let firstFocusableElement = doc.querySelector(
          ".text-size-minus-button"
        );
        let advancedHeader = doc.querySelector(".accordion-header");
        advancedHeader.focus();

        EventUtils.synthesizeKey("KEY_Tab", {}, content);
        is(
          doc.activeElement,
          firstFocusableElement,
          "Focus moves back to the first focusable button"
        );

        firstFocusableElement.focus();
        EventUtils.synthesizeKey("KEY_Tab", { shiftKey: true }, content);
        is(
          doc.activeElement,
          advancedHeader,
          "Focus moves to last focusable button"
        );

        // Expand the advanced layout accordion.
        advancedHeader.click();
        let resetButton = doc.querySelector(".text-layout-reset-button");
        resetButton.focus();

        EventUtils.synthesizeKey("KEY_Tab", {}, content);
        is(
          doc.activeElement,
          firstFocusableElement,
          "Focus moves back to the first focusable button"
        );

        firstFocusableElement.focus();
        EventUtils.synthesizeKey("KEY_Tab", { shiftKey: true }, content);
        is(
          doc.activeElement,
          resetButton,
          "Focus moves from first focusable button to last focusable button"
        );
      });
    }
  );
}

add_task(async function () {
  await testTextLayout("font_size", 7, "font-size", "24px");
  await testTextLayout("font_type", "monospace", "font-family", "monospace");
  await testTextLayout("font_weight", "bold", "font-weight", "bolder");
  await testTextLayout("content_width", 7, "content-width", "50em");
  await testTextLayout("line_height", 7, "line-height", "2.2em");
  await testTextLayout("character_spacing", 7, "letter-spacing", "0.18em");
  await testTextLayout("word_spacing", 7, "word-spacing", "0.30em");
  await testTextLayout("text_alignment", "right", "text-alignment", "right");
  await testTextLayoutReset();
  await testTextLayoutFocus();
});
