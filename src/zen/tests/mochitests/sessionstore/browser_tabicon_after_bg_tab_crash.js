"use strict";

const { ImageTestUtils } = ChromeUtils.importESModule(
  "resource://testing-common/ImageTestUtils.sys.mjs"
);

const FAVICON =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAsAAAALCAYAAACprHcmAAAARElEQVQYV2NkYLj3nwEnUGKEMxkYGBghilEFIQBTHKqYOIDFZHQ+DNz7j0MxdoDDGThNRgfoNsEATsXYARbFuAHtFAMAuvMbOrNomdAAAAAASUVORK5CYII=";
const PAGE_URL = `data:text/html,
<html>
  <head>
    <link rel="shortcut icon" href="${FAVICON}">
  </head>
  <body>
    Favicon!
  </body>
</html>`;

/**
 * Tests that if a background tab crashes that it doesn't
 * lose the favicon in the tab.
 */
add_task(async function test_tabicon_after_bg_tab_crash() {
  let originalTab = gBrowser.selectedTab;

  await BrowserTestUtils.withNewTab(
    {
      gBrowser,
      url: PAGE_URL,
    },
    async function (browser) {
      // Because there is debounce logic in FaviconLoader.sys.mjs to reduce the
      // favicon loads, we have to wait some time before checking that icon was
      // stored properly.
      await TestUtils.waitForCondition(
        () => {
          return gBrowser.getIcon() != null;
        },
        "wait for favicon load to finish",
        100,
        5
      );
      await ImageTestUtils.assertEqualImage(
        window,
        browser.mIconURL,
        FAVICON,
        "Favicon is correctly set."
      );

      await BrowserTestUtils.switchTab(gBrowser, originalTab);
      await BrowserTestUtils.crashFrame(
        browser,
        false /* shouldShowTabCrashPage */
      );
      await ImageTestUtils.assertEqualImage(
        window,
        browser.mIconURL,
        FAVICON,
        "Favicon is still set after crash."
      );
    }
  );
});
