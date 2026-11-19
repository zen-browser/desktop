/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/
 */

const TEST_PATH =
  getRootDirectory(gTestPath).replace(
    "chrome://mochitests/content",
    "https://example.com"
  ) + "bad_meta_tags.html";

/**
 * This tests that with the page bad_meta_tags.html, ContentMetaHandler.sys.mjs
 * parses out the meta tags available and does not store content provided by a
 * malformed meta tag. In this case the best defined meta tags are malformed, so
 * here we test that we store the next best ones - "description" and "twitter:image".
 * The list of meta tags and order of preference is found in
 * ContentMetaHandler.sys.mjs.
 */
add_task(async function test_bad_meta_tags() {
  const tab = await BrowserTestUtils.openNewForegroundTab(gBrowser, TEST_PATH);

  // Wait until places has stored the page info
  const pageInfo = await waitForPageInfo(TEST_PATH);
  is(
    pageInfo.description,
    "description",
    "did not collect a og:description because meta tag was malformed"
  );
  is(
    pageInfo.previewImageURL.href,
    // eslint-disable-next-line sdl/no-insecure-url
    "http://test.com/twitter-image.jpg",
    "did not collect og:image because of invalid loading principal"
  );

  BrowserTestUtils.removeTab(tab);
  await PlacesUtils.history.clear();
});
