/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const PREF = "zen.url-snippets.list";
const LEGACY = "zen-url-snippets.jsonlz4";

const { gZenUrlSnippets } = ChromeUtils.importESModule(
  "resource:///modules/zen/urlsnippets/ZenUrlSnippetsManager.sys.mjs"
);

add_setup(async function () {
  await gZenUrlSnippets.ready();
  await gZenUrlSnippets.resetStore();
  registerCleanupFunction(() => {
    Services.prefs.clearUserPref(PREF);
  });
});

add_task(async function test_duplicate_shortcuts_are_rejected() {
  await gZenUrlSnippets.resetStore();
  await gZenUrlSnippets.create("gh", "https://github.com");
  await Assert.rejects(
    gZenUrlSnippets.create("GH", "https://example.com"),
    /already exists/,
    "A shortcut cannot be added twice"
  );
  Assert.equal(gZenUrlSnippets.getAll().length, 2, "The rejected snippet is not stored");

  const other = await gZenUrlSnippets.create("mdn", "https://developer.mozilla.org");
  other.shortcut = "gh";
  await Assert.rejects(
    gZenUrlSnippets.update(other),
    /already exists/,
    "A shortcut cannot be renamed onto one that exists"
  );
  const blank = await gZenUrlSnippets.create("", "");
  ok(blank.id, "A blank shortcut is still allowed");
});

add_task(async function test_legacy_file_migrates_and_drops_duplicates() {
  await gZenUrlSnippets.resetStore();
  const path = PathUtils.join(PathUtils.profileDir, LEGACY);
  await IOUtils.writeJSON(
    path,
    {
      snippets: [
        { id: "11111111-1111-1111-1111-111111111111", shortcut: "gh", url: "https://github.com/" },
        { id: "22222222-2222-2222-2222-222222222222", shortcut: "GH", url: "https://github.com/dup" },
        { id: "33333333-3333-3333-3333-333333333333", shortcut: "mdn", url: "https://developer.mozilla.org/" },
      ],
    },
    { compress: true }
  );
  Services.prefs.clearUserPref(PREF);
  await gZenUrlSnippets.reload();

  const shortcuts = gZenUrlSnippets.getAll().map(snippet => snippet.shortcut);
  Assert.deepEqual(shortcuts, ["gh", "mdn"], "Migration keeps the first of each shortcut");
  ok(!(await IOUtils.exists(path)), "The legacy file is removed after migration");
  ok(
    Services.prefs.getStringPref(PREF, "").includes("github.com"),
    "The migrated list is stored in the synced pref"
  );
});
