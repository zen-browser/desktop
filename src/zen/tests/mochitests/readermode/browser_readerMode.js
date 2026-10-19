/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Test that the reader mode button appears and works properly on
 * reader-able content.
 */
const TEST_PREFS = [["reader.parse-on-load.enabled", true]];

const TEST_PATH = getRootDirectory(gTestPath).replace(
  "chrome://mochitests/content",
  "https://example.com"
);

var readerButton = document.getElementById("reader-mode-button");

ChromeUtils.defineESModuleGetters(this, {
  PlacesTestUtils: "resource://testing-common/PlacesTestUtils.sys.mjs",
  UrlbarTestUtils: "resource://testing-common/UrlbarTestUtils.sys.mjs",
});

add_task(async function test_reader_button() {
  registerCleanupFunction(function () {
    // Reset test prefs.
    TEST_PREFS.forEach(([name]) => {
      Services.prefs.clearUserPref(name);
    });
    while (gBrowser.tabs.length > 1) {
      gBrowser.removeCurrentTab();
    }
  });

  // Set required test prefs.
  TEST_PREFS.forEach(([name, value]) => {
    Services.prefs.setBoolPref(name, value);
  });

  let tab = (gBrowser.selectedTab = BrowserTestUtils.addTab(gBrowser));
  is_element_hidden(
    readerButton,
    "Reader mode button is not present on a new tab"
  );
  ok(
    !UITour.isInfoOnTarget(window, "readerMode-urlBar"),
    "Info panel shouldn't appear without the reader mode button"
  );

  // Point tab to a test page that is reader-able.
  let url = TEST_PATH + "readerModeArticle.html";
  // Set up favicon for testing.
  let favicon =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIW2NgYGD4DwABBAEAwS2OUAAAAABJRU5ErkJggg==";
  info("Adding visit so we can add favicon");
  await PlacesTestUtils.addVisits(new URL(url));
  info("Adding favicon");
  await PlacesTestUtils.addFavicons(new Map([[url, favicon]]));
  info("Opening tab and waiting for reader mode button to show up");

  await BrowserTestUtils.loadURIString({
    browser: tab.linkedBrowser,
    uriString: url,
  });
  await TestUtils.waitForCondition(() => !readerButton.hidden);

  is_element_visible(
    readerButton,
    "Reader mode button is present on a reader-able page"
  );

  // Switch page into reader mode.
  let promiseTabLoad = BrowserTestUtils.browserLoaded(tab.linkedBrowser);
  readerButton.click();
  await promiseTabLoad;

  let readerUrl = gBrowser.selectedBrowser.currentURI.spec;
  ok(
    readerUrl.startsWith("about:reader"),
    "about:reader loaded after clicking reader mode button"
  );
  is_element_visible(
    readerButton,
    "Reader mode button is present on about:reader"
  );
  let iconEl = tab.iconImage;
  await TestUtils.waitForCondition(
    () => iconEl.getBoundingClientRect().width != 0
  );
  is_element_visible(iconEl, "Favicon should be visible");
  is(iconEl.src, favicon, "Correct favicon should be loaded");

  is(gURLBar.untrimmedValue, url, "gURLBar value is about:reader URL");
  is(
    gURLBar.value,
    UrlbarTestUtils.trimURL(url),
    "gURLBar is displaying original article URL"
  );

  // Check selected value for URL bar
  await new Promise((resolve, reject) => {
    waitForClipboard(
      url,
      function () {
        gURLBar.focus();
        gURLBar.select();
        goDoCommand("cmd_copy");
      },
      resolve,
      reject
    );
  });

  info("Got correct URL when copying");

  // Switch page back out of reader mode.
  let promisePageShow = BrowserTestUtils.waitForContentEvent(
    tab.linkedBrowser,
    "pageshow",
    false,
    e => e.target.location.href != "about:blank"
  );
  readerButton.click();
  await promisePageShow;
  is(
    gBrowser.selectedBrowser.currentURI.spec,
    url,
    "Back to the original page after clicking active reader mode button"
  );
  ok(
    gBrowser.selectedBrowser.canGoForward,
    "Moved one step back in the session history."
  );

  let nonReadableUrl = TEST_PATH + "readerModeNonArticle.html";

  // Load a new tab that is NOT reader-able.
  let newTab = (gBrowser.selectedTab = BrowserTestUtils.addTab(gBrowser));
  await BrowserTestUtils.loadURIString({
    browser: newTab.linkedBrowser,
    uriString: nonReadableUrl,
  });
  await TestUtils.waitForCondition(() => readerButton.hidden);
  is_element_hidden(
    readerButton,
    "Reader mode button is not present on a non-reader-able page"
  );

  // Switch back to the original tab to make sure reader mode button is still visible.
  gBrowser.removeCurrentTab();
  await TestUtils.waitForCondition(() => !readerButton.hidden);
  is_element_visible(
    readerButton,
    "Reader mode button is present on a reader-able page"
  );

  // Load a new tab in reader mode that is NOT reader-able in the reader mode.
  newTab = gBrowser.selectedTab = BrowserTestUtils.addTab(gBrowser);
  let promiseAboutReaderError = BrowserTestUtils.waitForContentEvent(
    newTab.linkedBrowser,
    "AboutReaderContentError"
  );
  await BrowserTestUtils.loadURIString({
    browser: newTab.linkedBrowser,
    uriString: "about:reader?url=" + nonReadableUrl,
  });
  await promiseAboutReaderError;
  await TestUtils.waitForCondition(() => !readerButton.hidden);
  is_element_visible(
    readerButton,
    "Reader mode button is present on about:reader even in error state"
  );

  // Switch page back out of reader mode.
  promisePageShow = BrowserTestUtils.waitForContentEvent(
    newTab.linkedBrowser,
    "pageshow",
    false,
    e => e.target.location.href != "about:blank"
  );
  readerButton.click();
  await promisePageShow;
  is(
    gBrowser.selectedBrowser.currentURI.spec,
    nonReadableUrl,
    "Back to the original non-reader-able page after clicking active reader mode button"
  );
  await TestUtils.waitForCondition(() => readerButton.hidden);
  is_element_hidden(
    readerButton,
    "Reader mode button is not present on a non-reader-able page"
  );
});

add_task(async function test_getOriginalUrl() {
  let { ReaderMode } = ChromeUtils.importESModule(
    "moz-src:///toolkit/components/reader/ReaderMode.sys.mjs"
  );
  let url = "https://foo.com/article.html";

  is(
    ReaderMode.getOriginalUrl("about:reader?url=" + encodeURIComponent(url)),
    url,
    "Found original URL from encoded URL"
  );
  is(
    ReaderMode.getOriginalUrl("about:reader?foobar"),
    null,
    "Did not find original URL from malformed reader URL"
  );
  is(
    ReaderMode.getOriginalUrl(url),
    null,
    "Did not find original URL from non-reader URL"
  );

  let badUrl = "https://foo.com/?;$%^^";
  is(
    ReaderMode.getOriginalUrl("about:reader?url=" + encodeURIComponent(badUrl)),
    badUrl,
    "Found original URL from encoded malformed URL"
  );
  is(
    ReaderMode.getOriginalUrl("about:reader?url=" + badUrl),
    badUrl,
    "Found original URL from non-encoded malformed URL"
  );
});

add_task(async function test_reader_view_element_attribute_transform() {
  registerCleanupFunction(function () {
    while (gBrowser.tabs.length > 1) {
      gBrowser.removeCurrentTab();
    }
  });

  function observeAttribute(element, attributes, triggerFn, checkFn) {
    return new Promise(resolve => {
      let observer = new MutationObserver(mutations => {
        for (let mu of mutations) {
          if (element.getAttribute(mu.attributeName) !== mu.oldValue) {
            if (checkFn()) {
              resolve();
              observer.disconnect();
              return;
            }
          }
        }
      });

      observer.observe(element, {
        attributes: true,
        attributeOldValue: true,
        attributeFilter: Array.isArray(attributes) ? attributes : [attributes],
      });

      triggerFn();
    });
  }

  let menuitem = document.getElementById("menu_readerModeItem");
  let tab = await BrowserTestUtils.openNewForegroundTab(gBrowser);
  is(
    menuitem.hidden,
    true,
    "menuitem element should have the hidden attribute"
  );

  info("Navigate a reader-able page");
  function waitForNonBlankPage() {
    return BrowserTestUtils.waitForContentEvent(
      tab.linkedBrowser,
      "pageshow",
      false,
      e => e.target.location.href != "about:blank"
    );
  }
  let waitForPageshow = waitForNonBlankPage();
  await observeAttribute(
    menuitem,
    "hidden",
    () => {
      let url = TEST_PATH + "readerModeArticle.html";
      BrowserTestUtils.startLoadingURIString(tab.linkedBrowser, url);
    },
    () => !menuitem.hidden
  );
  is(
    menuitem.hidden,
    false,
    "menuitem's hidden attribute should be false on a reader-able page"
  );
  await waitForPageshow;

  info("Navigate a non-reader-able page");
  waitForPageshow = waitForNonBlankPage();
  await observeAttribute(
    menuitem,
    "hidden",
    () => {
      let url = TEST_PATH + "readerModeArticleHiddenNodes.html";
      BrowserTestUtils.startLoadingURIString(tab.linkedBrowser, url);
    },
    () => menuitem.hidden
  );
  is(
    menuitem.hidden,
    true,
    "menuitem's hidden attribute should be true on a non-reader-able page"
  );
  await waitForPageshow;

  info("Navigate a reader-able page");
  waitForPageshow = waitForNonBlankPage();
  await observeAttribute(
    menuitem,
    "hidden",
    () => {
      let url = TEST_PATH + "readerModeArticle.html";
      BrowserTestUtils.startLoadingURIString(tab.linkedBrowser, url);
    },
    () => !menuitem.hidden
  );
  is(
    menuitem.hidden,
    false,
    "menuitem's hidden attribute should be false on a reader-able page"
  );
  await waitForPageshow;

  info("Enter Reader Mode");
  waitForPageshow = waitForNonBlankPage();
  await observeAttribute(
    readerButton,
    "readeractive",
    () => {
      readerButton.click();
    },
    () => readerButton.getAttribute("readeractive") == "true"
  );
  is(
    readerButton.getAttribute("readeractive"),
    "true",
    "readerButton's readeractive attribute should be true when entering reader mode"
  );
  await waitForPageshow;

  info("Exit Reader Mode");
  waitForPageshow = waitForNonBlankPage();
  await observeAttribute(
    readerButton,
    ["readeractive", "hidden"],
    () => {
      readerButton.click();
    },
    () => {
      info(
        `active: ${readerButton.getAttribute("readeractive")}; hidden: ${
          menuitem.hidden
        }`
      );
      return !readerButton.getAttribute("readeractive") && !menuitem.hidden;
    }
  );
  ok(
    !readerButton.getAttribute("readeractive"),
    "readerButton's readeractive attribute should be empty when reader mode is exited"
  );
  ok(!menuitem.hidden, "menuitem should not be hidden.");
  await waitForPageshow;

  info("Navigate a non-reader-able page");
  waitForPageshow = waitForNonBlankPage();
  await observeAttribute(
    menuitem,
    "hidden",
    () => {
      let url = TEST_PATH + "readerModeArticleHiddenNodes.html";
      BrowserTestUtils.startLoadingURIString(tab.linkedBrowser, url);
    },
    () => menuitem.hidden
  );
  is(
    menuitem.hidden,
    true,
    "menuitem's hidden attribute should be true on a non-reader-able page"
  );
  await waitForPageshow;
});

add_task(async function test_reader_mode_lang() {
  let url = TEST_PATH + "readerModeArticle.html";
  let tab = await BrowserTestUtils.openNewForegroundTab(gBrowser);
  BrowserTestUtils.startLoadingURIString(tab.linkedBrowser, url);

  await BrowserTestUtils.loadURIString({
    browser: tab.linkedBrowser,
    uriString: url,
  });
  await TestUtils.waitForCondition(() => !readerButton.hidden);

  // Switch page into reader mode.
  let promiseTabLoad = BrowserTestUtils.browserLoaded(tab.linkedBrowser);
  readerButton.click();
  await promiseTabLoad;

  await SpecialPowers.spawn(gBrowser.selectedBrowser, [], () => {
    let container = content.document.querySelector(".container");
    is(container.lang, "en");
  });
});
