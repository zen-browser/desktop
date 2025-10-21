/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * Manually destroy the engine while a page is in the background, and test that the page
 * is still translated after switching back to it.
 */
add_task(async function test_translations_panel_fuzzing() {
  const {
    cleanup,
    runInPage: runInSpanishPage,
    tab: spanishTab,
  } = await loadTestPage({
    page: SPANISH_PAGE_URL,
    languagePairs: LANGUAGE_PAIRS,
    autoDownloadFromRemoteSettings: true,
  });

  /**
   * @typedef {object} Tab
   */

  /** @type {Tab?} */
  let englishTab;
  /** @type {Function?} */
  let removeEnglishTab;
  /** @type {boolean} */
  let isSpanishPageTranslated = false;
  /** @type {"spanish" | "english"} */
  let activeTab = "spanish";
  /** @type {boolean} */
  let isEngineMaybeDestroyed = true;
  /** @type {boolean} */
  let isTitleMutated = false;
  /** @type {boolean} */
  let hasVerifiedMutation = true;

  function reportOperation(name) {
    info(
      `\n\nOperation: ${name} ` +
        JSON.stringify({
          activeTab,
          englishTab: !!englishTab,
          isSpanishPageTranslated,
          isEngineMaybeDestroyed,
          isTitleMutated,
        })
    );
  }

  /**
   * A list of fuzzing operations. They return false when they are a noop given the
   * conditions.
   *
   * @type {object} - Record<string, () => Promise<boolean>>
   */
  const operations = {
    async addEnglishTab() {
      if (!englishTab) {
        reportOperation("addEnglishTab");
        const { removeTab, tab } = await addTab(
          ENGLISH_PAGE_URL,
          "Creating a new tab for a page in English."
        );

        englishTab = tab;
        removeEnglishTab = removeTab;
        activeTab = "english";
        return true;
      }
      return false;
    },

    async removeEnglishTab() {
      if (removeEnglishTab) {
        reportOperation("removeEnglishTab");
        await removeEnglishTab();

        englishTab = null;
        removeEnglishTab = null;
        activeTab = "spanish";
        return true;
      }
      return false;
    },

    async translateSpanishPage() {
      if (!isSpanishPageTranslated) {
        reportOperation("translateSpanishPage");
        if (activeTab === "english") {
          await switchTab(spanishTab, "spanish tab");
        }
        await FullPageTranslationsTestUtils.assertTranslationsButton(
          { button: true },
          "The button is available."
        );
        await FullPageTranslationsTestUtils.openPanel({
          onOpenPanel: FullPageTranslationsTestUtils.assertPanelViewDefault,
        });

        await FullPageTranslationsTestUtils.clickTranslateButton();

        await FullPageTranslationsTestUtils.assertTranslationsButton(
          { button: true, circleArrows: false, locale: true, icon: true },
          "Translations button is fully loaded."
        );

        await FullPageTranslationsTestUtils.assertOnlyIntersectingNodesAreTranslated(
          {
            fromLanguage: "es",
            toLanguage: "en",
            runInPage: runInSpanishPage,
          }
        );

        isSpanishPageTranslated = true;
        isEngineMaybeDestroyed = false;
        activeTab = "spanish";
        return true;
      }
      return false;
    },

    async destroyEngineProcess() {
      if (
        !isEngineMaybeDestroyed &&
        // Don't destroy the engine process until the mutation has been verified.
        // There is an artifical race (e.g. only in tests) that happens from a new
        // engine being requested, and forcefully destroyed before the it can be
        // initialized.
        hasVerifiedMutation
      ) {
        reportOperation("destroyEngineProcess");
        await EngineProcess.destroyTranslationsEngine();
        isEngineMaybeDestroyed = true;
      }
      return true;
    },

    async mutateSpanishPage() {
      if (isSpanishPageTranslated && !isTitleMutated) {
        reportOperation("mutateSpanishPage");

        info("Mutate the page's content to re-trigger a translation.");
        await runInSpanishPage(async TranslationsTest => {
          const { getH1 } = TranslationsTest.getSelectors();
          getH1().innerText = "New text for the H1";
        });

        if (isEngineMaybeDestroyed) {
          info("The engine may be recreated now.");
        }

        isEngineMaybeDestroyed = false;
        isTitleMutated = true;
        hasVerifiedMutation = false;
        return true;
      }
      return false;
    },

    async switchToSpanishTab() {
      if (activeTab !== "spanish") {
        reportOperation("switchToSpanishTab");
        await switchTab(spanishTab, "spanish tab");
        activeTab = "spanish";

        if (isTitleMutated) {
          await runInSpanishPage(async TranslationsTest => {
            const { getH1 } = TranslationsTest.getSelectors();
            await TranslationsTest.assertTranslationResult(
              "The mutated content should be translated.",
              getH1,
              "NEW TEXT FOR THE H1 [es to en]"
            );
          });
          hasVerifiedMutation = true;
        }

        return true;
      }
      return false;
    },

    async switchToEnglishTab() {
      if (activeTab !== "english" && englishTab) {
        reportOperation("switchToEnglishTab");
        await switchTab(englishTab, "english tab");
        activeTab = "english";
        return true;
      }
      return false;
    },

    async restoreSpanishPage() {
      if (activeTab === "spanish" && isSpanishPageTranslated) {
        reportOperation("restoreSpanishPage");
        await FullPageTranslationsTestUtils.openPanel({
          onOpenPanel: FullPageTranslationsTestUtils.assertPanelViewRevisit,
        });

        await FullPageTranslationsTestUtils.clickRestoreButton();

        await FullPageTranslationsTestUtils.assertPageIsNotTranslated(
          runInSpanishPage
        );

        await FullPageTranslationsTestUtils.assertTranslationsButton(
          { button: true, circleArrows: false, locale: false, icon: true },
          "The button is reverted to have an icon."
        );

        isSpanishPageTranslated = false;
        isTitleMutated = false;
        return true;
      }
      return false;
    },
  };

  const fuzzSteps = 100;
  info(`Starting the fuzzing with ${fuzzSteps} operations.`);
  const opsArray = Object.values(operations);

  for (let i = 0; i < fuzzSteps; i++) {
    // Pick a random operation and check if that it was not a noop, otherwise continue
    // trying to find a valid operation.
    // eslint-disable-next-line
    while (true) {
      const operation = opsArray[Math.floor(Math.random() * opsArray.length)];
      if (await operation()) {
        break;
      }
    }
  }

  if (removeEnglishTab) {
    await removeEnglishTab();
  }
  await cleanup();
});
