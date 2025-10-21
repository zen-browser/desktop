/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * Test that the full page translation panel works when multiple windows are used.
 */
add_task(async function test_browser_translations_full_page_multiple_windows() {
  const window1 = window;
  const testPage1 = await loadTestPage({
    page: SPANISH_PAGE_URL,
    languagePairs: LANGUAGE_PAIRS,
  });

  const window2 = await BrowserTestUtils.openNewBrowserWindow();

  const testPage2 = await loadTestPage({
    win: window2,
    page: SPANISH_PAGE_URL,
    languagePairs: LANGUAGE_PAIRS,
  });

  // Focus back to the original window first. This ensures coverage for invalid caching
  // logic involving multiple windows.
  await focusWindow(window1);

  info("Testing window 1");
  await FullPageTranslationsTestUtils.openPanel({
    expectedFromLanguage: "es",
    expectedToLanguage: "en",
    onOpenPanel: FullPageTranslationsTestUtils.assertPanelViewIntro,
  });
  await FullPageTranslationsTestUtils.clickTranslateButton({
    downloadHandler: testPage1.resolveDownloads,
  });
  await FullPageTranslationsTestUtils.assertOnlyIntersectingNodesAreTranslated({
    fromLanguage: "es",
    toLanguage: "en",
    runInPage: testPage1.runInPage,
    message: "Window 1 gets translated",
    win: window1,
  });

  await focusWindow(window2);

  info("Testing window 2");
  await FullPageTranslationsTestUtils.openPanel({
    win: window2,
    expectedFromLanguage: "es",
    expectedToLanguage: "en",
  });
  await FullPageTranslationsTestUtils.clickTranslateButton({ win: window2 });
  await FullPageTranslationsTestUtils.assertOnlyIntersectingNodesAreTranslated({
    fromLanguage: "es",
    toLanguage: "en",
    runInPage: testPage2.runInPage,
    message: "Window 2 gets translated",
    win: window2,
  });

  await testPage2.cleanup();
  await BrowserTestUtils.closeWindow(window2);
  await testPage1.cleanup();
});
