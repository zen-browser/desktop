/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_setup(async function () {
  await SpecialPowers.pushPrefEnv({
    set: [["test.wait300msAfterTabSwitch", true]],
  });
});

/**
 * This test case open 5 tabs across 2 windows, requesting a translation to a different language in all 5 tabs before
 * resolving all of the downloads at once. It then goes one by one through each open tab and ensures that they all show
 * the correct locale code as well as translate the page content to the correct language. It also ensures that the language
 * offered from the FullPageTranslationsPanel revisit view offers the correct language based on recent requests.
 */
add_task(
  async function test_full_page_translations_panel_recent_language_memory_with_multiple_windows_and_multiple_tabs() {
    const window1 = window;
    const {
      runInPage: runInEsEnPage,
      cleanup: cleanupWindow1,
      resolveBulkDownloads,
    } = await loadTestPage({
      page: SPANISH_PAGE_URL,
      languagePairs: [
        { fromLang: "es", toLang: "en" },
        { fromLang: "en", toLang: "es" },
        { fromLang: "fa", toLang: "en" },
        { fromLang: "en", toLang: "fa" },
        { fromLang: "sl", toLang: "en" },
        { fromLang: "en", toLang: "sl" },
        { fromLang: "uk", toLang: "en" },
        { fromLang: "en", toLang: "uk" },
        { fromLang: "fr", toLang: "en" },
        { fromLang: "en", toLang: "fr" },
      ],
    });
    let expectedWasmDownloads = 0;
    let expectedLanguagePairDownloads = 0;

    info("Opening a tab for es-en in window 1");

    await FullPageTranslationsTestUtils.assertTranslationsButton(
      { button: true, circleArrows: false, locale: false, icon: true },
      "The button is present and shows only the icon.",
      window1
    );
    await FullPageTranslationsTestUtils.assertPageIsNotTranslated(
      runInEsEnPage
    );
    await FullPageTranslationsTestUtils.openPanel({
      win: window1,
      expectedFromLanguage: "es",
      expectedToLanguage: "en",
    });
    await FullPageTranslationsTestUtils.clickTranslateButton({
      win: window1,
    });
    await FullPageTranslationsTestUtils.assertTranslationsButton(
      { button: true, circleArrows: true, locale: false, icon: true },
      "The button presents the loading indicator",
      window1
    );
    expectedWasmDownloads += 1;
    expectedLanguagePairDownloads += 1;

    info("Opening a tab for es-fa in window 2");

    const window2 = await BrowserTestUtils.openNewBrowserWindow();
    const { runInPage: runInEsFaPage, cleanup: cleanupWindow2 } =
      await loadTestPage({
        win: window2,
        page: SPANISH_PAGE_URL,
        languagePairs: LANGUAGE_PAIRS,
      });
    await FullPageTranslationsTestUtils.assertTranslationsButton(
      { button: true, circleArrows: false, locale: false, icon: true },
      "The button is present and shows only the icon.",
      window2
    );
    await FullPageTranslationsTestUtils.assertPageIsNotTranslated(
      runInEsFaPage
    );
    await FullPageTranslationsTestUtils.openPanel({
      win: window2,
      expectedFromLanguage: "es",
      expectedToLanguage: "en",
    });
    await FullPageTranslationsTestUtils.changeSelectedToLanguage({
      langTag: "fa",
      win: window2,
    });
    await FullPageTranslationsTestUtils.clickTranslateButton({
      win: window2,
    });
    await FullPageTranslationsTestUtils.assertTranslationsButton(
      { button: true, circleArrows: true, locale: false, icon: true },
      "The button presents the loading indicator",
      window2
    );
    expectedWasmDownloads += 1;
    expectedLanguagePairDownloads += 2;

    info("Opening a tab for es-sl in window 1");

    await focusWindow(window1);
    const { removeTab: removeEsSlTab, runInPage: runInEsSlPage } = await addTab(
      SPANISH_PAGE_URL,
      "Creating a new tab for es-sl",
      window1
    );
    await FullPageTranslationsTestUtils.assertTranslationsButton(
      { button: true, circleArrows: false, locale: false, icon: true },
      "The button is present and shows only the icon.",
      window1
    );
    await FullPageTranslationsTestUtils.assertPageIsNotTranslated(
      runInEsSlPage
    );
    await FullPageTranslationsTestUtils.openPanel({
      win: window1,
      expectedFromLanguage: "es",
      expectedToLanguage: "fa",
    });
    await FullPageTranslationsTestUtils.changeSelectedToLanguage({
      langTag: "sl",
      win: window1,
    });
    await FullPageTranslationsTestUtils.clickTranslateButton({
      win: window1,
    });
    await FullPageTranslationsTestUtils.assertTranslationsButton(
      { button: true, circleArrows: true, locale: false, icon: true },
      "The button presents the loading indicator",
      window1
    );
    expectedWasmDownloads += 1;
    expectedLanguagePairDownloads += 2;

    info("Opening a tab for es-uk in window 2");

    await focusWindow(window2);
    const { removeTab: removeEsUkTab, runInPage: runInEsUkPage } = await addTab(
      SPANISH_PAGE_URL,
      "Creating a new tab for es-uk",
      window2
    );
    await FullPageTranslationsTestUtils.assertTranslationsButton(
      { button: true, circleArrows: false, locale: false, icon: true },
      "The button is present and shows only the icon.",
      window2
    );
    await FullPageTranslationsTestUtils.assertPageIsNotTranslated(
      runInEsUkPage
    );
    await FullPageTranslationsTestUtils.openPanel({
      win: window2,
      expectedFromLanguage: "es",
      expectedToLanguage: "sl",
    });
    await FullPageTranslationsTestUtils.changeSelectedToLanguage({
      langTag: "uk",
      win: window2,
    });
    await FullPageTranslationsTestUtils.clickTranslateButton({
      win: window2,
    });
    await FullPageTranslationsTestUtils.assertTranslationsButton(
      { button: true, circleArrows: true, locale: false, icon: true },
      "The button presents the loading indicator",
      window2
    );
    expectedWasmDownloads += 1;
    expectedLanguagePairDownloads += 2;

    info("Opening a tab for fr-es in window 1");

    await focusWindow(window1);
    const { removeTab: removeFrEsTab, runInPage: runInFrEsPage } = await addTab(
      FRENCH_PAGE_URL,
      "Creating a new tab for fr-es",
      window1
    );
    await FullPageTranslationsTestUtils.assertTranslationsButton(
      { button: true, circleArrows: false, locale: false, icon: true },
      "The button is present and shows only the icon.",
      window1
    );
    await runInFrEsPage(async TranslationsTest => {
      const { getH1 } = TranslationsTest.getSelectors();
      await TranslationsTest.assertTranslationResult(
        "The French page's H1 is translated from fr to es",
        getH1,
        "Cet élément d'en-tête HTML est écrit en français."
      );
    });
    await FullPageTranslationsTestUtils.openPanel({
      win: window1,
      expectedFromLanguage: "fr",
      expectedToLanguage: "uk",
    });
    await FullPageTranslationsTestUtils.changeSelectedToLanguage({
      langTag: "es",
      win: window1,
    });
    await FullPageTranslationsTestUtils.clickTranslateButton({
      win: window1,
    });
    await FullPageTranslationsTestUtils.assertTranslationsButton(
      { button: true, circleArrows: true, locale: false, icon: true },
      "The button presents the loading indicator",
      window1
    );
    expectedWasmDownloads += 1;
    expectedLanguagePairDownloads += 2;

    info("Resolving all pending downloads for all open tabs");

    await resolveBulkDownloads({
      expectedWasmDownloads,
      expectedLanguagePairDownloads,
    });

    info("Ensuring that the fr-es tab is translated correctly");

    await FullPageTranslationsTestUtils.assertLangTagIsShownOnTranslationsButton(
      "fr",
      "es",
      window1
    );
    await runInFrEsPage(async TranslationsTest => {
      const { getH1 } = TranslationsTest.getSelectors();
      await TranslationsTest.assertTranslationResult(
        "The French page's H1 is translated from fr to es",
        getH1,
        "CET ÉLÉMENT D'EN-TÊTE HTML EST ÉCRIT EN FRANÇAIS. [fr to es]"
      );
    });
    await FullPageTranslationsTestUtils.openPanel({
      win: window1,
      expectedToLanguage: "uk",
    });
    await removeFrEsTab();

    info("Ensuring that the es-uk tab is translated correctly");

    await focusWindow(window2);
    await FullPageTranslationsTestUtils.assertOnlyIntersectingNodesAreTranslated(
      {
        fromLanguage: "es",
        toLanguage: "uk",
        runInPage: runInEsUkPage,
        message: "The es-uk page should be translated to uk",
        win: window2,
      }
    );
    await FullPageTranslationsTestUtils.openPanel({
      win: window2,
      expectedToLanguage: "sl",
    });
    await removeEsUkTab();

    info("Ensuring that the es-sl tab is translated correctly");

    await focusWindow(window1);
    await FullPageTranslationsTestUtils.assertOnlyIntersectingNodesAreTranslated(
      {
        fromLanguage: "es",
        toLanguage: "sl",
        runInPage: runInEsSlPage,
        message: "The es-sl page should be translated to sl",
        win: window1,
      }
    );
    await FullPageTranslationsTestUtils.openPanel({
      win: window1,
      expectedToLanguage: "uk",
    });
    await removeEsSlTab();

    info("Ensuring that the es-fa tab is translated correctly");

    await focusWindow(window2);
    await FullPageTranslationsTestUtils.assertOnlyIntersectingNodesAreTranslated(
      {
        fromLanguage: "es",
        toLanguage: "fa",
        runInPage: runInEsFaPage,
        message: "The es-fa page should be translated to fa",
        win: window2,
      }
    );
    await FullPageTranslationsTestUtils.openPanel({
      win: window2,
      expectedToLanguage: "uk",
    });

    info("Ensuring that the es-en tab is translated correctly");

    await focusWindow(window1);
    await FullPageTranslationsTestUtils.assertOnlyIntersectingNodesAreTranslated(
      {
        fromLanguage: "es",
        toLanguage: "en",
        runInPage: runInEsEnPage,
        message: "The es-en page should be translated to en",
        win: window1,
      }
    );
    await FullPageTranslationsTestUtils.openPanel({
      win: window1,
      expectedToLanguage: "uk",
    });

    await cleanupWindow2();
    await BrowserTestUtils.closeWindow(window2);
    await cleanupWindow1();
  }
);
