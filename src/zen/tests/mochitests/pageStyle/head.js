/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

const WEB_ROOT = getRootDirectory(gTestPath).replace(
  "chrome://mochitests/content",
  "https://example.com"
);

/**
 * Waits for the stylesheets to be loaded into the browser menu.
 *
 * @param browser
 *        The browser that contains the webpage we're testing.
 * @param styleSheetCount
 *        How many stylesheets we expect to be loaded.
 * @return Promise
 */
function promiseStylesheetsLoaded(browser, styleSheetCount) {
  return TestUtils.waitForCondition(() => {
    let actor =
      browser.browsingContext?.currentWindowGlobal?.getActor("PageStyle");
    if (!actor) {
      info("No jswindowactor (yet?)");
      return false;
    }
    let sheetCount = actor.getSheetInfo().filteredStyleSheets.length;
    info(`waiting for sheets: ${sheetCount}`);
    return sheetCount >= styleSheetCount;
  }, "waiting for style sheets to load");
}
