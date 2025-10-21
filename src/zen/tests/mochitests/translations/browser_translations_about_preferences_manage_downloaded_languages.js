/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

function getFrenchModels() {
  return languageModelNames([
    { fromLang: "fr", toLang: "en" },
    { fromLang: "en", toLang: "fr" },
  ]);
}

add_task(async function test_about_preferences_manage_languages() {
  await testWithAndWithoutLexicalShortlist(async lexicalShortlistPrefs => {
    const {
      cleanup,
      remoteClients,
      elements: {
        downloadAllLabel,
        downloadAll,
        deleteAll,
        frenchLabel,
        frenchDownload,
        frenchDelete,
        spanishLabel,
        spanishDownload,
        spanishDelete,
        ukrainianLabel,
        ukrainianDownload,
        ukrainianDelete,
      },
    } = await setupAboutPreferences(LANGUAGE_PAIRS, {
      prefs: [
        ["browser.translations.newSettingsUI.enable", false],
        ...lexicalShortlistPrefs,
      ],
    });

    is(
      downloadAllLabel.getAttribute("data-l10n-id"),
      "translations-manage-download-description",
      "The first row is all of the languages."
    );
    is(frenchLabel.textContent, "French", "There is a French row.");
    is(spanishLabel.textContent, "Spanish", "There is a Spanish row.");
    is(ukrainianLabel.textContent, "Ukrainian", "There is a Ukrainian row.");

    await ensureVisibility({
      message: "Everything starts out as available to download",
      visible: {
        downloadAll,
        frenchDownload,
        spanishDownload,
        ukrainianDownload,
      },
      hidden: { deleteAll, frenchDelete, spanishDelete, ukrainianDelete },
    });

    click(frenchDownload, "Downloading French");

    const frenchModels = getFrenchModels();

    Assert.deepEqual(
      await remoteClients.translationModels.resolvePendingDownloads(
        frenchModels.length
      ),
      frenchModels,
      "French models were downloaded."
    );

    await ensureVisibility({
      message: "French can now be deleted, and delete all is available.",
      visible: {
        downloadAll,
        deleteAll,
        frenchDelete,
        spanishDownload,
        ukrainianDownload,
      },
      hidden: { frenchDownload, spanishDelete, ukrainianDelete },
    });

    click(frenchDelete, "Deleting French");

    await ensureVisibility({
      message: "Everything can be downloaded.",
      visible: {
        downloadAll,
        frenchDownload,
        spanishDownload,
        ukrainianDownload,
      },
      hidden: { deleteAll, frenchDelete, spanishDelete, ukrainianDelete },
    });

    click(downloadAll, "Downloading all languages.");

    const allModels = languageModelNames(LANGUAGE_PAIRS);
    Assert.deepEqual(
      await remoteClients.translationModels.resolvePendingDownloads(
        allModels.length
      ),
      allModels,
      "All models were downloaded."
    );
    Assert.deepEqual(
      await remoteClients.translationsWasm.resolvePendingDownloads(1),
      ["bergamot-translator"],
      "Wasm was downloaded."
    );

    await ensureVisibility({
      message: "Everything can be deleted.",
      visible: { deleteAll, frenchDelete, spanishDelete, ukrainianDelete },
      hidden: {
        downloadAll,
        frenchDownload,
        spanishDownload,
        ukrainianDownload,
      },
    });

    click(deleteAll, "Deleting all languages.");

    await ensureVisibility({
      message: "Everything can be downloaded again",
      visible: {
        downloadAll,
        frenchDownload,
        spanishDownload,
        ukrainianDownload,
      },
      hidden: { deleteAll, frenchDelete, spanishDelete, ukrainianDelete },
    });

    click(frenchDownload, "Downloading French.");
    click(spanishDownload, "Downloading Spanish.");
    click(ukrainianDownload, "Downloading Ukrainian.");

    Assert.deepEqual(
      await remoteClients.translationModels.resolvePendingDownloads(
        allModels.length
      ),
      allModels,
      "All models were downloaded again."
    );

    remoteClients.translationsWasm.assertNoNewDownloads();

    await ensureVisibility({
      message: "Everything is downloaded again.",
      visible: { deleteAll, frenchDelete, spanishDelete, ukrainianDelete },
      hidden: {
        downloadAll,
        frenchDownload,
        spanishDownload,
        ukrainianDownload,
      },
    });

    await cleanup();
  });
});

add_task(async function test_about_preferences_download_reject() {
  const {
    cleanup,
    remoteClients,
    elements: { document, frenchDownload },
  } = await setupAboutPreferences(LANGUAGE_PAIRS, {
    prefs: [["browser.translations.newSettingsUI.enable", false]],
  });

  click(frenchDownload, "Downloading French");

  is(
    maybeGetByL10nId("translations-manage-error-download", document),
    null,
    "No error messages are present."
  );

  const failureErrors = await captureTranslationsError(() =>
    remoteClients.translationModels.rejectPendingDownloads(
      getFrenchModels().length
    )
  );

  ok(
    !!failureErrors.length,
    `The errors for download should have been reported, found ${failureErrors.length} errors`
  );
  for (const { error } of failureErrors) {
    is(
      error?.message,
      "Failed to download file.",
      "The error reported was a download error."
    );
  }

  await waitForCondition(
    () => maybeGetByL10nId("translations-manage-error-download", document),
    "The error message is now visible."
  );

  click(frenchDownload, "Attempting to download French again", document);
  is(
    maybeGetByL10nId("translations-manage-error-download", document),
    null,
    "The error message is hidden again."
  );

  const successErrors = await captureTranslationsError(() =>
    remoteClients.translationModels.resolvePendingDownloads(
      getFrenchModels().length
    )
  );

  is(
    successErrors.length,
    0,
    "Expected no errors downloading French the second time"
  );

  await cleanup();
});
