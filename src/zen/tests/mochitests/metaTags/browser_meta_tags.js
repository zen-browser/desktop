/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/
 */

const TEST_PATH =
  getRootDirectory(gTestPath).replace(
    "chrome://mochitests/content",
    "https://example.com"
  ) + "meta_tags.html";
/**
 * This tests that with the page meta_tags.html, ContentMetaHandler.sys.mjs
 * parses out the meta tags avilable and only stores the best one for description
 * and one for preview image url. In the case of this test, the best defined meta
 * tags are "og:description" and "og:image:secure_url". The list of meta tags
 * and order of preference is found in ContentMetaHandler.sys.mjs.
 */
add_task(async function test_metadata() {
  const tab = await BrowserTestUtils.openNewForegroundTab(gBrowser, TEST_PATH);

  // Wait until places has stored the page info
  const pageInfo = await waitForPageInfo(TEST_PATH);
  is(pageInfo.description, "og:description", "got the correct description");
  is(
    pageInfo.previewImageURL.href,
    "https://test.com/og-image-secure-url.jpg",
    "got the correct preview image"
  );

  BrowserTestUtils.removeTab(tab);
  await PlacesUtils.history.clear();
});

/**
 * This test is almost like the previous one except it opens a second tab to
 * make sure the extra tab does not cause the debounce logic to be skipped. If
 * incorrectly skipped, the updated metadata would not include the delayed meta.
 */
add_task(async function multiple_tabs() {
  const tab = await BrowserTestUtils.openNewForegroundTab(gBrowser, TEST_PATH);

  // Add a background tab to cause another page to load *without* putting the
  // desired URL in a background tab, which results in its timers being throttled.
  BrowserTestUtils.addTab(gBrowser);

  // Wait until places has stored the page info
  const pageInfo = await waitForPageInfo(TEST_PATH);
  is(pageInfo.description, "og:description", "got the correct description");
  is(
    pageInfo.previewImageURL.href,
    "https://test.com/og-image-secure-url.jpg",
    "got the correct preview image"
  );

  BrowserTestUtils.removeTab(tab);
  BrowserTestUtils.removeTab(gBrowser.selectedTab);
  await PlacesUtils.history.clear();
});
