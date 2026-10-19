/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * Opens a link (with a #:~:text= fragment) via the three context-menu
 * commands (new tab, new window, private window) and checks that the
 * destination page really scrolled to the fragment.
 *
 * See Bug 1955664.
 */

const TARGET_URL =
  getRootDirectory(gTestPath).replace(
    "chrome://mochitests/content",
    "https://example.org"
  ) +
  "scroll-to-text-fragment-from-browser-chrome-target.html" +
  "#:~:text=This%20is%20the%20text%20fragment%20to%20scroll%20to.";

// A minimal parent page served as a data: URL with one <a id="theLink">.
const PARENT_DATA_URL =
  "data:text/html;base64," +
  btoa(`data:text/html,<a id="theLink" href="${TARGET_URL}">Open link</a>`);

// Map variant -> context-menu command ID.
const VARIANTS = {
  TAB: "context-openlinkintab",
  WINDOW: "context-openlink",
  PRIVATE: "context-openlinkprivate",
};

async function openContextMenu(browser, selector) {
  const menu = document.getElementById("contentAreaContextMenu");
  const shown = BrowserTestUtils.waitForEvent(menu, "popupshown");

  await BrowserTestUtils.synthesizeMouseAtCenter(
    selector,
    { type: "contextmenu", button: 2 },
    browser
  );
  await shown;
  return menu;
}

function waitForScroll(browser) {
  return SpecialPowers.spawn(browser, [], () => {
    return new Promise(resolve => {
      if (content.scrollY > 0) {
        resolve(true);
      } else {
        content.addEventListener("scroll", () => resolve(true), {
          once: true,
          capture: true,
        });
      }
    });
  });
}

async function runVariant(menuItemId) {
  await BrowserTestUtils.withNewTab(
    { gBrowser, url: PARENT_DATA_URL },
    async browser => {
      const menu = await openContextMenu(browser, "#theLink");

      let opened;
      switch (menuItemId) {
        case VARIANTS.TAB:
          opened = BrowserTestUtils.waitForNewTab(gBrowser);
          break;
        case VARIANTS.WINDOW:
          opened = BrowserTestUtils.waitForNewWindow();
          break;
        case VARIANTS.PRIVATE:
          opened = BrowserTestUtils.waitForNewWindow({ private: true });
          break;
        default:
          throw new Error(`Unexpected context-menu id: ${menuItemId}`);
      }
      const popupHidden = BrowserTestUtils.waitForEvent(menu, "popuphidden");

      const item = menu.ownerDocument.getElementById(menuItemId);
      ok(!item.hidden, `${menuItemId} should be visible in this context`);
      menu.activateItem(item);

      await popupHidden;
      const ctx = await opened;

      const newBrowser = ctx.linkedBrowser || ctx.gBrowser.selectedBrowser;

      await BrowserTestUtils.browserLoaded(newBrowser, false);

      let scrolled = await waitForScroll(newBrowser);
      ok(scrolled, `${menuItemId}: scrolled to text fragment`);

      if (ctx.close) {
        await BrowserTestUtils.closeWindow(ctx); // window
      } else {
        BrowserTestUtils.removeTab(ctx); // tab
      }
    }
  );
}

add_task(async function test_open_in_new_tab() {
  await runVariant(VARIANTS.TAB);
});

add_task(async function test_open_in_new_window() {
  await runVariant(VARIANTS.WINDOW);
});

add_task(async function test_open_in_private_window() {
  await runVariant(VARIANTS.PRIVATE);
});
