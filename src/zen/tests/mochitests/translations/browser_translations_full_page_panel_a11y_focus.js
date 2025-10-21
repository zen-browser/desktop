/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * Tests the a11y focus behavior.
 */
add_task(async function test_translations_panel_a11y_focus() {
  const { cleanup } = await loadTestPage({
    page: SPANISH_PAGE_URL,
    languagePairs: LANGUAGE_PAIRS,
  });

  await FullPageTranslationsTestUtils.assertTranslationsButton(
    { button: true },
    "The button is available."
  );

  await FullPageTranslationsTestUtils.openPanel({
    expectedFromLanguage: "es",
    expectedToLanguage: "en",
    openWithKeyboard: true,
    onOpenPanel: FullPageTranslationsTestUtils.assertPanelViewIntro,
  });

  is(
    document.activeElement.getAttribute("data-l10n-id"),
    "translations-panel-settings-button",
    "The settings button is focused."
  );

  await cleanup();
});
