/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const { PermissionTestUtils } = ChromeUtils.importESModule(
  "resource://testing-common/PermissionTestUtils.sys.mjs"
);

add_task(async function test_about_preferences_never_translate_site_settings() {
  const {
    cleanup,
    elements: { settingsButton },
  } = await setupAboutPreferences(LANGUAGE_PAIRS, {
    prefs: [["browser.translations.newSettingsUI.enable", false]],
    permissionsUrls: [
      "https://example.com",
      "https://example.org",
      "https://example.net",
    ],
  });

  info("Ensuring the list of never-translate sites is empty");
  is(
    getNeverTranslateSitesFromPerms().length,
    0,
    "The list of never-translate sites is empty"
  );

  info("Adding two sites to the neverTranslateSites perms");
  PermissionTestUtils.add(
    "https://example.com",
    TRANSLATIONS_PERMISSION,
    Services.perms.DENY_ACTION
  );
  PermissionTestUtils.add(
    "https://example.org",
    TRANSLATIONS_PERMISSION,
    Services.perms.DENY_ACTION
  );
  PermissionTestUtils.add(
    "https://example.net",
    TRANSLATIONS_PERMISSION,
    Services.perms.DENY_ACTION
  );

  const dialogWindow = await waitForOpenDialogWindow(
    "chrome://browser/content/preferences/dialogs/translations.xhtml",
    () => {
      click(
        settingsButton,
        "Opening the about:preferences Translations Settings"
      );
    }
  );
  let tree = dialogWindow.document.getElementById("neverTranslateSitesTree");
  let remove = dialogWindow.document.getElementById("removeNeverTranslateSite");
  let removeAll = dialogWindow.document.getElementById(
    "removeAllNeverTranslateSites"
  );

  is(tree.view.rowCount, 3, "The never-translate sites list has 2 items");
  ok(remove.disabled, "The 'Remove Site' button is disabled");
  ok(!removeAll.disabled, "The 'Remove All Sites' button is enabled");

  info("Selecting the first never-translate site.");
  tree.view.selection.select(0);
  ok(!remove.disabled, "The 'Remove Site' button is enabled");

  click(remove, "Clicking the remove-site button");
  is(
    tree.view.rowCount,
    2,
    "The never-translate sites list now contains 2 items"
  );
  is(
    getNeverTranslateSitesFromPerms().length,
    2,
    "There are 2 sites with permissions"
  );

  info("Removing all sites from the neverTranslateSites perms");
  PermissionTestUtils.remove("https://example.com", TRANSLATIONS_PERMISSION);
  PermissionTestUtils.remove("https://example.org", TRANSLATIONS_PERMISSION);
  PermissionTestUtils.remove("https://example.net", TRANSLATIONS_PERMISSION);

  is(tree.view.rowCount, 0, "The never-translate sites list is empty");
  ok(remove.disabled, "The 'Remove Site' button is disabled");
  ok(removeAll.disabled, "The 'Remove All Sites' button is disabled");

  info("Adding more sites to the neverTranslateSites perms");
  PermissionTestUtils.add(
    "https://example.org",
    TRANSLATIONS_PERMISSION,
    Services.perms.DENY_ACTION
  );
  PermissionTestUtils.add(
    "https://example.com",
    TRANSLATIONS_PERMISSION,
    Services.perms.DENY_ACTION
  );
  PermissionTestUtils.add(
    "https://example.net",
    TRANSLATIONS_PERMISSION,
    Services.perms.DENY_ACTION
  );

  is(tree.view.rowCount, 3, "The never-translate sites list has 3 items");
  ok(remove.disabled, "The 'Remove Site' button is disabled");
  ok(!removeAll.disabled, "The 'Remove All Sites' button is enabled");

  click(removeAll, "Clicking the remove-all sites button");
  is(tree.view.rowCount, 0, "The never-translate sites list is empty");
  ok(remove.disabled, "The 'Remove Site' button is disabled");
  ok(removeAll.disabled, "The 'Remove All Sites' button is disabled");
  is(
    getNeverTranslateSitesFromPerms().length,
    0,
    "There are no sites in the neverTranslateSites perms"
  );

  await waitForCloseDialogWindow(dialogWindow);
  await cleanup();
});
