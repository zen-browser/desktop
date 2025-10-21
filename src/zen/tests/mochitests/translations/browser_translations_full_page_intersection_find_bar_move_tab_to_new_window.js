/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * This test case ensures that opening the FindBar on a page where Full-Page Translations is active
 * transitions into content-eager translations mode, even after moving the tab to a new window, which
 * necessarily changes to a different FindBar instance.
 */
add_task(
  async function test_findbar_open_switches_to_content_eager_mode_after_moving_tab_to_new_window() {
    const window1 = window;
    const { cleanup, resolveDownloads, runInPage, tab } = await loadTestPage({
      page: SPANISH_PAGE_URL,
      languagePairs: LANGUAGE_PAIRS,
    });

    await FullPageTranslationsTestUtils.assertTranslationsButton(
      { button: true },
      "The translations button is visible.",
      window1
    );

    await FullPageTranslationsTestUtils.assertPageIsNotTranslated(runInPage);

    await FullPageTranslationsTestUtils.openPanel({
      expectedFromLanguage: "es",
      expectedToLanguage: "en",
      onOpenPanel: FullPageTranslationsTestUtils.assertPanelViewIntro,
      win: window1,
    });

    await FullPageTranslationsTestUtils.clickTranslateButton({
      downloadHandler: resolveDownloads,
      win: window1,
    });

    await FullPageTranslationsTestUtils.assertOnlyIntersectingNodesAreTranslated(
      {
        fromLanguage: "es",
        toLanguage: "en",
        runInPage,
      }
    );

    info("Moving the tab to a new window of its own.");
    const window2 = await window1.gBrowser.replaceTabWithWindow(tab);
    const swapDocShellPromise = BrowserTestUtils.waitForEvent(
      tab.linkedBrowser,
      "SwapDocShells"
    );
    await swapDocShellPromise;

    const tab2 = window2.gBrowser.selectedTab;
    function runInPage2(callback, data = {}) {
      return ContentTask.spawn(
        tab2.linkedBrowser,
        { contentData: data, callbackSource: callback.toString() },
        function ({ contentData, callbackSource }) {
          const TranslationsTest = ChromeUtils.importESModule(
            "chrome://mochitests/content/browser/toolkit/components/translations/tests/browser/translations-test.mjs"
          );
          TranslationsTest.setup({ Assert, ContentTaskUtils, content });
          // eslint-disable-next-line no-eval
          let contentCallback = eval(`(${callbackSource})`);
          return contentCallback(TranslationsTest, contentData);
        }
      );
    }

    await FullPageTranslationsTestUtils.assertTranslationsButton(
      { button: true },
      "The translations button is visible.",
      window2
    );

    info(
      "Opening the find bar in the new window, which should switch us into content eager mode."
    );
    await openFindBar(tab2, window2);

    await FullPageTranslationsTestUtils.assertAllPageContentIsTranslated({
      win: window2,
      fromLanguage: "es",
      toLanguage: "en",
      runInPage: runInPage2,
    });

    await FullPageTranslationsTestUtils.assertPageFinalParagraphTitleIsNotTranslated(
      {
        win: window2,
        runInPage: runInPage2,
        message:
          "Attribute translations are always lazy based on intersection, so the final paragraph's title should remain untranslated.",
      }
    );

    await scrollToBottomOfPage(runInPage2);

    await FullPageTranslationsTestUtils.assertPageFinalParagraphTitleIsTranslated(
      {
        win: window2,
        fromLanguage: "es",
        toLanguage: "en",
        runInPage: runInPage2,
      }
    );

    await cleanup();
    await BrowserTestUtils.closeWindow(window2);
  }
);

/**
 * This test case ensures that closing the FindBar on a page where Full-Page Translations is active
 * transitions into lazy translations mode, even after moving the tab to a new window, which
 * necessarily changes to a different FindBar instance.
 */
add_task(
  async function test_findbar_close_switches_to_lazy_mode_after_moving_tab_to_new_window() {
    const window1 = window;
    const { cleanup, resolveDownloads, runInPage, tab } = await loadTestPage({
      page: SPANISH_PAGE_URL,
      languagePairs: LANGUAGE_PAIRS,
      contentEagerMode: true,
    });

    // Moving a tab to a new window with the findbar open appears to modify this pref.
    // Pushing it to a pref env ensures that a failure will not be reported due to the pref changing.
    await SpecialPowers.pushPrefEnv({
      set: [["accessibility.typeaheadfind.flashBar", 0]],
    });

    await FullPageTranslationsTestUtils.assertTranslationsButton(
      { button: true },
      "The translations button is visible.",
      window1
    );

    await FullPageTranslationsTestUtils.assertPageIsNotTranslated(runInPage);

    await FullPageTranslationsTestUtils.openPanel({
      expectedFromLanguage: "es",
      expectedToLanguage: "en",
      onOpenPanel: FullPageTranslationsTestUtils.assertPanelViewIntro,
      win: window1,
    });

    await FullPageTranslationsTestUtils.clickTranslateButton({
      downloadHandler: resolveDownloads,
      win: window1,
    });

    await FullPageTranslationsTestUtils.assertAllPageContentIsTranslated({
      fromLanguage: "es",
      toLanguage: "en",
      runInPage,
    });

    info("Moving the tab to a new window of its own.");
    const window2 = await window1.gBrowser.replaceTabWithWindow(tab);
    const swapDocShellPromise = BrowserTestUtils.waitForEvent(
      tab.linkedBrowser,
      "SwapDocShells"
    );
    await swapDocShellPromise;

    const tab2 = window2.gBrowser.selectedTab;
    function runInPage2(callback, data = {}) {
      return ContentTask.spawn(
        tab2.linkedBrowser,
        { contentData: data, callbackSource: callback.toString() },
        function ({ contentData, callbackSource }) {
          const TranslationsTest = ChromeUtils.importESModule(
            "chrome://mochitests/content/browser/toolkit/components/translations/tests/browser/translations-test.mjs"
          );
          TranslationsTest.setup({ Assert, ContentTaskUtils, content });
          // eslint-disable-next-line no-eval
          let contentCallback = eval(`(${callbackSource})`);
          return contentCallback(TranslationsTest, contentData);
        }
      );
    }

    await FullPageTranslationsTestUtils.assertTranslationsButton(
      { button: true },
      "The translations button is visible.",
      window2
    );

    info(
      "Closing the find bar in the new window, which should switch the page back to lazy mode."
    );
    await closeFindBar(tab2, window2);

    info("Mutating the final paragraph text content and title attribute.");
    await runInPage2(async TranslationsTest => {
      const { getFinalParagraph } = TranslationsTest.getSelectors();
      const p = getFinalParagraph();

      p.innerText = "Este contenido de texto de último párrafo se modificó.";
      p.setAttribute(
        "title",
        "Este atributo de título de último párrafo se modificó."
      );
    });

    await FullPageTranslationsTestUtils.waitForAllPendingTranslationsToComplete(
      runInPage2
    );

    info(
      "Ensuring mutated final paragraph content and attributes are not translated while out of view in lazy mode."
    );
    await runInPage2(async TranslationsTest => {
      const { getFinalParagraph, getFinalParagraphTitle } =
        TranslationsTest.getSelectors();

      await TranslationsTest.assertTranslationResult(
        "The mutated final paragraph text content is not translated.",
        getFinalParagraph,
        "Este contenido de texto de último párrafo se modificó."
      );

      await TranslationsTest.assertTranslationResult(
        "The mutated final paragraph title attribute is not translated.",
        getFinalParagraphTitle,
        "Este atributo de título de último párrafo se modificó."
      );
    });

    info("Scrolling to the bottom of the page so the paragraph intersects.");
    await scrollToBottomOfPage(runInPage2);

    await resolveDownloads(1);

    await FullPageTranslationsTestUtils.waitForAllPendingTranslationsToComplete(
      runInPage2
    );

    info(
      "Asserting the mutated final paragraph content and title are now translated after intersecting."
    );
    await runInPage2(async TranslationsTest => {
      const { getFinalParagraph, getFinalParagraphTitle } =
        TranslationsTest.getSelectors();

      await TranslationsTest.assertTranslationResult(
        "The mutated final paragraph text content is translated.",
        getFinalParagraph,
        "ESTE CONTENIDO DE TEXTO DE ÚLTIMO PÁRRAFO SE MODIFICÓ. [es to en]"
      );

      await TranslationsTest.assertTranslationResult(
        "The mutated final paragraph title attribute is translated.",
        getFinalParagraphTitle,
        "ESTE ATRIBUTO DE TÍTULO DE ÚLTIMO PÁRRAFO SE MODIFICÓ. [es to en]"
      );
    });

    await SpecialPowers.popPrefEnv();

    await cleanup();
    await BrowserTestUtils.closeWindow(window2);
  }
);
