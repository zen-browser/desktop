/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const TEST_PATH = getRootDirectory(gTestPath).replace(
  "chrome://mochitests/content",
  "https://example.com"
);

/**
 * Test that the reader mode menus open and close correctly on click
 * and on keyboard input.
 */
add_task(async function () {
  await BrowserTestUtils.withNewTab(
    TEST_PATH + "readerModeArticleShort.html",
    async function (browser) {
      let pageShownPromise = BrowserTestUtils.waitForContentEvent(
        browser,
        "AboutReaderContentReady"
      );
      let readerButton = document.getElementById("reader-mode-button");
      readerButton.click();
      await pageShownPromise;
      await SpecialPowers.spawn(browser, [], async function () {
        function dispatchMouseEvent(win, target, eventName) {
          let mouseEvent = new win.MouseEvent(eventName, {
            view: win,
            bubbles: true,
            cancelable: true,
            composed: true,
          });
          target.dispatchEvent(mouseEvent);
        }

        function simulateClick(target) {
          dispatchMouseEvent(win, target, "mousedown");
          dispatchMouseEvent(win, target, "mouseup");
          dispatchMouseEvent(win, target, "click");
        }

        async function testOpenCloseDropdown(target) {
          let button = doc.querySelector(`.${target}-button`);

          let dropdown = doc.querySelector(`.${target}-dropdown`);
          ok(!dropdown.classList.contains("open"), "dropdown is closed");

          simulateClick(button);
          ok(dropdown.classList.contains("open"), "dropdown is open");

          // simulate clicking on the article title to close the dropdown
          let title = doc.querySelector(".reader-title");
          simulateClick(title);
          ok(!dropdown.classList.contains("open"), "dropdown is closed");

          // reopen the dropdown
          simulateClick(button);
          ok(dropdown.classList.contains("open"), "dropdown is open");

          // now click on the button again to close it
          simulateClick(button);
          ok(!dropdown.classList.contains("open"), "dropdown is closed");

          // reopen the dropdown
          simulateClick(button);
          ok(dropdown.classList.contains("open"), "dropdown is open");

          // use the ESC key to close it
          EventUtils.synthesizeKey("KEY_Escape", {}, win);
          ok(!dropdown.classList.contains("open"), "dropdown is closed");
        }

        let doc = content.document;
        let win = content.window;

        testOpenCloseDropdown("style");
        testOpenCloseDropdown("colors");
      });
    }
  );
});

/**
 * Test that the reader mode menus close on scroll, unless they are
 * currently being hovered.
 */
add_task(async function () {
  await BrowserTestUtils.withNewTab(
    TEST_PATH + "readerModeArticleContainsLink.html",
    async function (browser) {
      let pageShownPromise = BrowserTestUtils.waitForContentEvent(
        browser,
        "AboutReaderContentReady"
      );
      let readerButton = document.getElementById("reader-mode-button");
      readerButton.click();
      await pageShownPromise;

      let scrollEventPromise = BrowserTestUtils.waitForContentEvent(
        browser,
        "scroll",
        true
      );

      await SpecialPowers.spawn(browser, [], async function () {
        let doc = content.document;
        let dropdown = doc.querySelector(".text-layout-dropdown");

        doc.querySelector(".text-layout-button").click();
        ok(dropdown.classList.contains("open"), "dropdown is open");

        // hover outside the dropdown and scroll
        let domain = doc.querySelector(".reader-domain");
        EventUtils.synthesizeMouseAtCenter(
          domain,
          { type: "mousemove" },
          content.window
        );
        content.window.scrollBy(0, 200);
      });
      await scrollEventPromise;
      await SpecialPowers.spawn(browser, [], async function () {
        let dropdown = content.document.querySelector(".text-layout-dropdown");
        ok(!dropdown.classList.contains("open"), "dropdown is closed");
      });

      scrollEventPromise = BrowserTestUtils.waitForContentEvent(
        browser,
        "scroll",
        true
      );

      await SpecialPowers.spawn(browser, [], async function () {
        let doc = content.document;
        let dropdown = doc.querySelector(".text-layout-dropdown");

        // reopen the dropdown
        doc.querySelector(".text-layout-button").click();
        ok(dropdown.classList.contains("open"), "dropdown is open");

        // hover over the dropdown and scroll
        let dropdownPopup = dropdown.querySelector(".dropdown-popup");
        EventUtils.synthesizeMouseAtCenter(
          dropdownPopup,
          {
            type: "mousemove",
          },
          content.window
        );
        content.window.scrollBy(0, 200);
      });
      await scrollEventPromise;
      await SpecialPowers.spawn(browser, [], async function () {
        let dropdown = content.document.querySelector(".text-layout-dropdown");
        ok(dropdown.classList.contains("open"), "dropdown remains open");
      });
    }
  );
});
