/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const { PromiseTestUtils } = ChromeUtils.importESModule(
  "resource://testing-common/PromiseTestUtils.sys.mjs"
);

/**
 * This tests a specific defect where the error view was not showing properly
 * when navigating to an auto-translated page after visiting a page in an unsupported
 * language and viewing the panel.
 *
 * This test case tests the case where the auto translate fails and the panel
 * automatically opens the panel to show the error view.
 *
 * See https://bugzilla.mozilla.org/show_bug.cgi?id=1845611 for more information.
 */
add_task(
  async function test_revisit_view_updates_with_auto_translate_failure() {
    const { cleanup, resolveDownloads, rejectDownloads, runInPage } =
      await loadTestPage({
        page: SPANISH_PAGE_URL,
        languagePairs: [
          // Do not include French.
          { fromLang: "en", toLang: "es" },
          { fromLang: "es", toLang: "en" },
        ],
      });

    await FullPageTranslationsTestUtils.assertTranslationsButton(
      { button: true, circleArrows: false, locale: false, icon: true },
      "The translations button is visible."
    );

    await FullPageTranslationsTestUtils.openPanel({
      expectedFromLanguage: "es",
      expectedToLanguage: "en",
      onOpenPanel: FullPageTranslationsTestUtils.assertPanelViewIntro,
    });
    await FullPageTranslationsTestUtils.openTranslationsSettingsMenu();

    await FullPageTranslationsTestUtils.assertIsAlwaysTranslateLanguage("es", {
      checked: false,
    });
    await FullPageTranslationsTestUtils.clickAlwaysTranslateLanguage({
      downloadHandler: resolveDownloads,
    });
    await FullPageTranslationsTestUtils.assertIsAlwaysTranslateLanguage("es", {
      checked: true,
    });

    await FullPageTranslationsTestUtils.assertOnlyIntersectingNodesAreTranslated(
      {
        fromLanguage: "es",
        toLanguage: "en",
        runInPage,
      }
    );

    await navigate("Navigate to a page in an unsupported language", {
      url: FRENCH_PAGE_URL,
    });

    await FullPageTranslationsTestUtils.assertTranslationsButton(
      { button: false },
      "The translations button should be unavailable."
    );

    await FullPageTranslationsTestUtils.openPanel({
      openFromAppMenu: true,
      onOpenPanel:
        FullPageTranslationsTestUtils.assertPanelViewUnsupportedLanguage,
    });

    info("Destroy the engine process so that an error will happen.");
    await EngineProcess.destroyTranslationsEngine();

    await navigate("Navigate back to a Spanish page.", {
      url: SPANISH_PAGE_URL_DOT_ORG,
      downloadHandler: rejectDownloads,
      onOpenPanel: FullPageTranslationsTestUtils.assertPanelViewError,
    });

    await cleanup();
  }
);
