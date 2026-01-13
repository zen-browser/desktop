/* Check for the correct behaviour of the report web forgery/not a web forgery
menu items.

Mac makes this astonishingly painful to test since their help menu is special magic,
but we can at least test it on the other platforms.*/

const NORMAL_PAGE = "http://example.com";
const PHISH_PAGE = "http://www.itisatrap.org/firefox/its-a-trap.html";

/**
 * Opens a new tab and browses to some URL, tests for the existence
 * of the phishing menu items, and then runs a test function to check
 * the state of the menu once opened. This function will take care of
 * opening and closing the menu.
 *
 * @param url (string)
 *        The URL to browse the tab to.
 * @param testFn (function)
 *        The function to run once the menu has been opened. This
 *        function will be passed the "reportMenu" and "errorMenu"
 *        DOM nodes as arguments, in that order. This function
 *        should not yield anything.
 * @returns Promise
 */
function check_menu_at_page(url, testFn) {
  return BrowserTestUtils.withNewTab(
    {
      gBrowser,
      url: "about:blank",
    },
    async function (browser) {
      // We don't get load events when the DocShell redirects to error
      // pages, but we do get DOMContentLoaded, so we'll wait for that.
      let dclPromise = SpecialPowers.spawn(browser, [], async function () {
        await ContentTaskUtils.waitForEvent(this, "DOMContentLoaded", false);
      });
      BrowserTestUtils.startLoadingURIString(browser, url);
      await dclPromise;

      let menu = document.getElementById("menu_HelpPopup");
      ok(menu, "Help menu should exist");

      let reportMenu = document.getElementById(
        "menu_HelpPopup_reportPhishingtoolmenu"
      );
      ok(reportMenu, "Report phishing menu item should exist");

      let errorMenu = document.getElementById(
        "menu_HelpPopup_reportPhishingErrortoolmenu"
      );
      ok(errorMenu, "Report phishing error menu item should exist");

      let menuOpen = BrowserTestUtils.waitForEvent(menu, "popupshown");
      menu.openPopup(null, "", 0, 0, false, null);
      await menuOpen;

      testFn(reportMenu, errorMenu);

      let menuClose = BrowserTestUtils.waitForEvent(menu, "popuphidden");
      menu.hidePopup();
      await menuClose;
    }
  );
}

/**
 * Tests that we show the "Report this page" menu item at a normal
 * page.
 */
add_task(async function () {
  await check_menu_at_page(NORMAL_PAGE, (reportMenu, errorMenu) => {
    ok(
      !reportMenu.hidden,
      "Report phishing menu should be visible on normal sites"
    );
    ok(
      errorMenu.hidden,
      "Report error menu item should be hidden on normal sites"
    );
  });
});

/**
 * Tests that we show the "Report this page is okay" menu item at
 * a reported attack site.
 */
add_task(async function () {
  await check_menu_at_page(PHISH_PAGE, (reportMenu, errorMenu) => {
    ok(
      reportMenu.hidden,
      "Report phishing menu should be hidden on phishing sites"
    );
    ok(
      !errorMenu.hidden,
      "Report error menu item should be visible on phishing sites"
    );
  });
});
