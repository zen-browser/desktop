/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * This test case tests a specific situation described in Bug 1893776
 * where the Translations panels were not initializing correctly after
 * dragging a tab to become its own new window after opening the panel
 * in the previous window.
 */
add_task(async function test_browser_translations_full_page_multiple_windows() {
  const window1 = window;
  const testPage = await loadTestPage({
    page: SPANISH_PAGE_URL,
    languagePairs: LANGUAGE_PAIRS,
  });

  await FullPageTranslationsTestUtils.assertTranslationsButton(
    { button: true, circleArrows: false, locale: false, icon: true },
    "The translations button is visible.",
    window1
  );

  info("Opening FullPageTranslationsPanel in window1");
  await FullPageTranslationsTestUtils.openPanel({
    expectedFromLanguage: "es",
    expectedToLanguage: "en",
    onOpenPanel: FullPageTranslationsTestUtils.assertPanelViewIntro,
  });

  await FullPageTranslationsTestUtils.clickCancelButton();

  info("Moving the tab to a new window of its own");
  const window2 = await window1.gBrowser.replaceTabWithWindow(testPage.tab);
  const swapDocShellPromise = BrowserTestUtils.waitForEvent(
    testPage.tab.linkedBrowser,
    "SwapDocShells"
  );
  await swapDocShellPromise;

  await FullPageTranslationsTestUtils.assertTranslationsButton(
    { button: true, circleArrows: false, locale: false, icon: true },
    "The translations button is visible.",
    window2
  );

  info("Opening FullPageTranslationsPanel in window2");
  await FullPageTranslationsTestUtils.openPanel({
    expectedFromLanguage: "es",
    expectedToLanguage: "en",
    win: window2,
  });

  info("Translating the same page in window2");
  await FullPageTranslationsTestUtils.clickTranslateButton({
    win: window2,
    downloadHandler: testPage.resolveDownloads,
  });
  await FullPageTranslationsTestUtils.assertLangTagIsShownOnTranslationsButton(
    "es",
    "en",
    window2
  );

  await testPage.cleanup();
  await BrowserTestUtils.closeWindow(window2);
});
