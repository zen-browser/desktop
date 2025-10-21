/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * This test case ensures that the Translations URL-bar button does not become active in a tab
 * where it is not currently present, when downloads complete and the TranslationsEngine
 * becomes ready for translations that were requested in a different tab.
 */
add_task(async function test_button_does_not_update_when_button_is_not_shown() {
  const {
    tab: englishTab,
    resolveDownloads,
    cleanup,
  } = await loadTestPage({
    page: ENGLISH_PAGE_URL,
    languagePairs: LANGUAGE_PAIRS,
  });

  await FullPageTranslationsTestUtils.assertTranslationsButton(
    { button: false },
    "The button should not be present since English is a known user language."
  );

  const {
    tab: spanishTab,
    runInPage: runInSpanishPage,
    removeTab,
  } = await addTab(
    SPANISH_PAGE_URL,
    "Creating a new tab for a page in Spanish."
  );

  await FullPageTranslationsTestUtils.assertTranslationsButton(
    { button: true, circleArrows: false, locale: false, icon: true },
    "The button is present in the Spanish page."
  );

  await FullPageTranslationsTestUtils.assertPageIsNotTranslated(
    runInSpanishPage
  );

  await FullPageTranslationsTestUtils.openPanel({
    expectedFromLanguage: "es",
    expectedToLanguage: "en",
    onOpenPanel: FullPageTranslationsTestUtils.assertPanelViewIntro,
  });

  await FullPageTranslationsTestUtils.clickTranslateButton();

  await FullPageTranslationsTestUtils.assertTranslationsButton(
    { button: true, circleArrows: true, locale: false, icon: true },
    "The icon presents the loading indicator."
  );

  await switchTab(englishTab, "Switch to English tab");

  await FullPageTranslationsTestUtils.assertTranslationsButton(
    { button: false },
    "The button should still not be present on the English page before resolving downloads."
  );

  await resolveDownloads(1);

  await FullPageTranslationsTestUtils.assertTranslationsButton(
    { button: false },
    "The button should still not be present on the English page after resolving downloads."
  );

  await switchTab(spanishTab, "Switch back to the Spanish tab");

  await FullPageTranslationsTestUtils.assertLangTagIsShownOnTranslationsButton(
    "es",
    "en"
  );

  await FullPageTranslationsTestUtils.assertOnlyIntersectingNodesAreTranslated({
    fromLanguage: "es",
    toLanguage: "en",
    runInPage: runInSpanishPage,
  });

  await removeTab();
  await cleanup();
});

/**
 * This test case ensures that the Translations URL-bar button does not become active in a tab
 * where it is present but inactive, when downloads complete and the TranslationsEngine
 * becomes ready for translations that were requested in a different tab.
 */
add_task(
  async function test_button_does_not_update_when_button_is_shown_but_inactive() {
    const {
      tab: spanishTabDotCom,
      runInPage: runInSpanishDotComPage,
      resolveDownloads,
      cleanup,
    } = await loadTestPage({
      page: SPANISH_PAGE_URL,
      languagePairs: LANGUAGE_PAIRS,
    });

    await FullPageTranslationsTestUtils.assertTranslationsButton(
      { button: true, circleArrows: false, locale: false, icon: true },
      "The button is present Spanish .com tab."
    );

    await FullPageTranslationsTestUtils.assertPageIsNotTranslated(
      runInSpanishDotComPage
    );

    const {
      tab: spanishTabDotOrg,
      runInPage: runInSpanishDotOrgPage,
      removeTab,
    } = await addTab(
      SPANISH_PAGE_URL_DOT_ORG,
      "Creating a new tab for a page in Spanish with a .org URL."
    );

    await FullPageTranslationsTestUtils.assertTranslationsButton(
      { button: true, circleArrows: false, locale: false, icon: true },
      "The button is present Spanish .org tab."
    );

    await FullPageTranslationsTestUtils.assertPageIsNotTranslated(
      runInSpanishDotOrgPage
    );

    await FullPageTranslationsTestUtils.openPanel({
      expectedFromLanguage: "es",
      expectedToLanguage: "en",
      onOpenPanel: FullPageTranslationsTestUtils.assertPanelViewIntro,
    });

    await FullPageTranslationsTestUtils.changeSelectedToLanguage({
      langTag: "fr",
    });
    await FullPageTranslationsTestUtils.clickTranslateButton();

    await FullPageTranslationsTestUtils.assertTranslationsButton(
      { button: true, circleArrows: true, locale: false, icon: true },
      "The icon presents the loading indicator on the Spanish .org tab."
    );

    await switchTab(spanishTabDotCom, "Switch to the Spanish .com tab.");

    await FullPageTranslationsTestUtils.assertTranslationsButton(
      { button: true, circleArrows: false, locale: false, icon: true },
      "The button should be present but inactive on the Spanish .com tab."
    );

    await resolveDownloads(2);

    await FullPageTranslationsTestUtils.assertTranslationsButton(
      { button: true, circleArrows: false, locale: false, icon: true },
      "The button should be present but inactive on the Spanish .com tab, even after resolving downloads."
    );
    await FullPageTranslationsTestUtils.assertPageIsNotTranslated(
      runInSpanishDotComPage
    );

    await switchTab(spanishTabDotOrg, "Switch back to the Spanish .org tab");

    await FullPageTranslationsTestUtils.assertOnlyIntersectingNodesAreTranslated(
      {
        fromLanguage: "es",
        toLanguage: "fr",
        runInPage: runInSpanishDotOrgPage,
      }
    );

    await removeTab();
    await cleanup();
  }
);

/**
 * This test case ensures that the Translations URL-bar button does not change its displayed
 * locale in a tab where it is present and active, when downloads complete and the TranslationsEngine
 * becomes ready for translations that were requested in a different tab for a different language.
 */
add_task(
  async function test_button_does_not_update_when_button_is_shown_but_inactive() {
    const {
      tab: spanishTabDotCom,
      runInPage: runInSpanishDotComPage,
      resolveDownloads,
      cleanup,
    } = await loadTestPage({
      page: SPANISH_PAGE_URL,
      languagePairs: LANGUAGE_PAIRS,
    });

    await FullPageTranslationsTestUtils.assertTranslationsButton(
      { button: true, circleArrows: false, locale: false, icon: true },
      "The button is present Spanish .com tab."
    );

    await FullPageTranslationsTestUtils.assertPageIsNotTranslated(
      runInSpanishDotComPage
    );

    await FullPageTranslationsTestUtils.openPanel({
      expectedFromLanguage: "es",
      expectedToLanguage: "en",
      onOpenPanel: FullPageTranslationsTestUtils.assertPanelViewIntro,
    });

    await FullPageTranslationsTestUtils.changeSelectedToLanguage({
      langTag: "fr",
    });
    await FullPageTranslationsTestUtils.clickTranslateButton({
      pivotTranslation: true,
      downloadHandler: resolveDownloads,
    });

    await FullPageTranslationsTestUtils.assertOnlyIntersectingNodesAreTranslated(
      {
        fromLanguage: "es",
        toLanguage: "fr",
        runInPage: runInSpanishDotComPage,
      }
    );

    const {
      tab: spanishTabDotOrg,
      runInPage: runInSpanishDotOrgPage,
      removeTab,
    } = await addTab(
      SPANISH_PAGE_URL_DOT_ORG,
      "Creating a new tab for a page in Spanish with a .org URL."
    );

    await FullPageTranslationsTestUtils.assertTranslationsButton(
      { button: true, circleArrows: false, locale: false, icon: true },
      "The button is present but not active in the Spanish .org tab."
    );

    await FullPageTranslationsTestUtils.assertPageIsNotTranslated(
      runInSpanishDotOrgPage
    );

    await FullPageTranslationsTestUtils.openPanel({
      expectedFromLanguage: "es",
      expectedToLanguage: "fr",
      onOpenPanel: FullPageTranslationsTestUtils.assertPanelViewDefault,
    });

    await FullPageTranslationsTestUtils.changeSelectedToLanguage({
      langTag: "uk",
    });
    await FullPageTranslationsTestUtils.clickTranslateButton();

    await FullPageTranslationsTestUtils.assertTranslationsButton(
      { button: true, circleArrows: true, locale: false, icon: true },
      "The icon presents the loading indicator on the Spanish .org tab."
    );

    await switchTab(spanishTabDotCom, "Switch to the Spanish .com tab.");

    info("The Spanish .com page should still be translated to French.");
    await FullPageTranslationsTestUtils.assertOnlyIntersectingNodesAreTranslated(
      {
        fromLanguage: "es",
        toLanguage: "fr",
        runInPage: runInSpanishDotComPage,
      }
    );

    await resolveDownloads(2);

    info(
      "The Spanish .com page should still be translated to French, even after resolving downloads."
    );
    await FullPageTranslationsTestUtils.assertOnlyIntersectingNodesAreTranslated(
      {
        fromLanguage: "es",
        toLanguage: "fr",
        runInPage: runInSpanishDotComPage,
      }
    );

    await switchTab(spanishTabDotOrg, "Switch back to the Spanish .org tab");

    info("The Spanish .org page should be translated to Ukrainian.");
    await FullPageTranslationsTestUtils.assertOnlyIntersectingNodesAreTranslated(
      {
        fromLanguage: "es",
        toLanguage: "uk",
        runInPage: runInSpanishDotOrgPage,
      }
    );

    await removeTab();
    await cleanup();
  }
);
