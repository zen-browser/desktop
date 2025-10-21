/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * This test case verifies the behavior of the FullPageTranslationsPanel when the source
 * language has a script tag and the target language does not have a script tag.
 */
add_task(async function test_translations_panel_source_lang_has_script_tag() {
  const { cleanup, resolveDownloads, runInPage } = await loadTestPage({
    page: SPANISH_PAGE_URL,
    languagePairs: [
      { fromLang: "es", toLang: "en" },
      { fromLang: "en", toLang: "es" },
      { fromLang: "zh-Hans", toLang: "en" },
    ],
  });

  await FullPageTranslationsTestUtils.assertTranslationsButton(
    { button: true },
    "The button is available."
  );

  await FullPageTranslationsTestUtils.assertPageIsNotTranslated(runInPage);

  await FullPageTranslationsTestUtils.openPanel({
    expectedFromLanguage: "es",
    expectedToLanguage: "en",
    onOpenPanel: FullPageTranslationsTestUtils.assertPanelViewIntro,
  });

  await FullPageTranslationsTestUtils.changeSelectedFromLanguage({
    langTag: "zh-Hans",
  });

  await FullPageTranslationsTestUtils.changeSelectedToLanguage({
    langTag: "es",
  });

  await FullPageTranslationsTestUtils.clickTranslateButton({
    downloadHandler: resolveDownloads,
    pivotTranslation: true,
  });

  await FullPageTranslationsTestUtils.assertOnlyIntersectingNodesAreTranslated({
    fromLanguage: "zh-Hans",
    toLanguage: "es",
    runInPage,
  });

  await cleanup();
});

/**
 * This test case verifies the behavior of the FullPageTranslationsPanel when the target
 * language has a script tag and the source language does not have a script tag.
 */
add_task(async function test_translations_panel_target_lang_has_script_tag() {
  const { cleanup, resolveDownloads, runInPage } = await loadTestPage({
    page: SPANISH_PAGE_URL,
    languagePairs: [
      { fromLang: "es", toLang: "en" },
      { fromLang: "en", toLang: "es" },
      { fromLang: "en", toLang: "zh-Hant" },
    ],
  });

  await FullPageTranslationsTestUtils.assertTranslationsButton(
    { button: true },
    "The button is available."
  );

  await FullPageTranslationsTestUtils.assertPageIsNotTranslated(runInPage);

  await FullPageTranslationsTestUtils.openPanel({
    expectedFromLanguage: "es",
    expectedToLanguage: "en",
    onOpenPanel: FullPageTranslationsTestUtils.assertPanelViewIntro,
  });

  await FullPageTranslationsTestUtils.changeSelectedToLanguage({
    langTag: "zh-Hant",
  });

  await FullPageTranslationsTestUtils.clickTranslateButton({
    downloadHandler: resolveDownloads,
    pivotTranslation: true,
  });

  await FullPageTranslationsTestUtils.assertOnlyIntersectingNodesAreTranslated({
    fromLanguage: "es",
    toLanguage: "zh-Hant",
    runInPage,
  });

  await cleanup();
});

/**
 * This test case verifies the behavior of the FullPageTranslationsPanel when both the source
 * language and the target language have a script tag.
 */
add_task(
  async function test_translations_panel_source_and_target_langs_have_script_tags() {
    const { cleanup, resolveDownloads, runInPage } = await loadTestPage({
      page: SPANISH_PAGE_URL,
      languagePairs: [
        { fromLang: "es", toLang: "en" },
        { fromLang: "en", toLang: "es" },
        { fromLang: "zh-Hans", toLang: "en" },
        { fromLang: "en", toLang: "zh-Hans" },
        { fromLang: "zh-Hant", toLang: "en" },
        { fromLang: "en", toLang: "zh-Hant" },
      ],
    });

    await FullPageTranslationsTestUtils.assertTranslationsButton(
      { button: true },
      "The button is available."
    );

    await FullPageTranslationsTestUtils.assertPageIsNotTranslated(runInPage);

    await FullPageTranslationsTestUtils.openPanel({
      expectedFromLanguage: "es",
      expectedToLanguage: "en",
      onOpenPanel: FullPageTranslationsTestUtils.assertPanelViewIntro,
    });

    await FullPageTranslationsTestUtils.changeSelectedFromLanguage({
      langTag: "zh-Hant",
    });
    await FullPageTranslationsTestUtils.changeSelectedToLanguage({
      langTag: "zh-Hans",
    });

    await FullPageTranslationsTestUtils.clickTranslateButton({
      downloadHandler: resolveDownloads,
      pivotTranslation: true,
    });

    await FullPageTranslationsTestUtils.assertOnlyIntersectingNodesAreTranslated(
      {
        fromLanguage: "zh-Hant",
        toLanguage: "zh-Hans",
        runInPage,
      }
    );

    await cleanup();
  }
);
