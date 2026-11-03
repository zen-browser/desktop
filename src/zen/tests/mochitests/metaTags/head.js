ChromeUtils.defineESModuleGetters(this, {
  PlacesTestUtils: "resource://testing-common/PlacesTestUtils.sys.mjs",
  PlacesUtils: "resource://gre/modules/PlacesUtils.sys.mjs",
});

/**
 * Wait for url's page info (non-null description and preview url) to be set.
 * Because there is debounce logic in FaviconLoader.sys.mjs to only make one
 * single SQL update, we have to wait for some time before checking that the page
 * info was stored.
 */
async function waitForPageInfo(url) {
  let pageInfo;
  await TestUtils.waitForCondition(async () => {
    pageInfo = await PlacesUtils.history.fetch(url, { includeMeta: true });
    return pageInfo && pageInfo.description && pageInfo.previewImageURL;
  });
  return pageInfo;
}
