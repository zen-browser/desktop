/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * This test case verifies that the proper error message is displayed in
 * the FullPageTranslationsPanel if the panel tries to open, but the language
 * dropdown menus fail to initialize.
 */
add_task(async function test_full_page_translations_panel_init_failure() {
  const { cleanup } = await loadTestPage({
    page: SPANISH_PAGE_URL,
    languagePairs: LANGUAGE_PAIRS,
  });

  TranslationsPanelShared.simulateLangListError();
  await FullPageTranslationsTestUtils.openPanel({
    onOpenPanel: FullPageTranslationsTestUtils.assertPanelViewInitFailure,
  });

  await FullPageTranslationsTestUtils.clickCancelButton();

  await cleanup();
});
