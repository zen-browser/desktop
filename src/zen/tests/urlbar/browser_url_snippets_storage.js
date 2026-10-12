/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const { gZenUrlSnippets, normalizeSnippetShortcut, normalizeSnippetURL, normalizeUrlSnippetsData } =
  ChromeUtils.importESModule(
    "resource:///modules/zen/urlsnippets/ZenUrlSnippetsManager.sys.mjs"
  );

add_setup(async function () {
  await gZenUrlSnippets.ready();
  await gZenUrlSnippets.resetStore();
  registerCleanupFunction(async () => {
    await gZenUrlSnippets.resetStore();
  });
});

add_task(async function test_default_youtube_seed_and_no_reseed() {
  const seeded = gZenUrlSnippets.getAll();
  Assert.equal(seeded.length, 1, "A new store seeds one snippet");
  Assert.equal(seeded[0].shortcut, "yt", "The default shortcut is yt");
  Assert.equal(
    seeded[0].url,
    "https://youtube.com",
    "The default URL is YouTube"
  );

  await gZenUrlSnippets.remove(seeded[0].id);
  Assert.equal(gZenUrlSnippets.getAll().length, 0, "The default can be removed");

  await gZenUrlSnippets.reload();
  Assert.equal(
    gZenUrlSnippets.getAll().length,
    0,
    "An empty list is not seeded again"
  );
});

add_task(async function test_create_update_remove() {
  await gZenUrlSnippets.resetStore();
  const created = await gZenUrlSnippets.create("gh", "https://github.com");
  Assert.equal(gZenUrlSnippets.getAll().length, 2, "Create appends after the default");

  created.url = "https://github.com/zen-browser";
  await gZenUrlSnippets.update(created);
  const fetched = gZenUrlSnippets.getAll().find(snippet => snippet.id == created.id);
  Assert.equal(fetched.shortcut, "gh", "Shortcut is kept on update");
  Assert.equal(
    fetched.url,
    "https://github.com/zen-browser",
    "URL update is stored"
  );

  await gZenUrlSnippets.remove(created.id);
  ok(
    !gZenUrlSnippets.getAll().some(snippet => snippet.id == created.id),
    "Remove deletes only the requested snippet"
  );
});

add_task(async function test_match_order_and_heuristic() {
  await gZenUrlSnippets.resetStore();
  const matches = gZenUrlSnippets.match("yt");
  Assert.equal(matches[0].snippet.url, "https://youtube.com");
  Assert.equal(matches[0].heuristic, true, "An exact shortcut is the heuristic");

  const prefix = gZenUrlSnippets.match("Y");
  Assert.equal(prefix.length, 1, "Matching is case-insensitive");
  Assert.equal(prefix[0].heuristic, true, "The only prefix match is the heuristic");

  const all = gZenUrlSnippets.match("");
  Assert.greater(all.length, 0, "An empty query lists every snippet");
  Assert.ok(
    all.every(item => !item.heuristic),
    "Listing every snippet does not preselect one"
  );
});

add_task(async function test_create_rejects_disallowed_scheme() {
  await gZenUrlSnippets.resetStore();
  await Assert.rejects(
    gZenUrlSnippets.create("js", "javascript:alert(1)"),
    /Unsupported snippet URL/,
    "javascript: snippets are rejected"
  );
  ok(
    !gZenUrlSnippets.getAll().some(snippet => snippet.shortcut === "js"),
    "A rejected snippet is not stored"
  );
});

add_task(function test_normalize_helpers() {
  Assert.equal(normalizeSnippetShortcut(" yt "), "yt");
  Assert.equal(normalizeSnippetShortcut("y t"), null);
  Assert.equal(normalizeSnippetShortcut(""), null);
  Assert.equal(normalizeSnippetURL("youtube.com"), "https://youtube.com/");
  Assert.equal(normalizeSnippetURL("https://youtube.com"), "https://youtube.com/");
  Assert.equal(normalizeSnippetURL("mint://note"), "mint://note");
  Assert.equal(normalizeSnippetURL("not a url"), null);
  Assert.equal(normalizeSnippetURL("javascript:alert(1)"), null);
  Assert.equal(normalizeSnippetURL("data:text/html,hi"), null);
  Assert.equal(normalizeSnippetURL("file:///etc/passwd"), null);

  const stored = normalizeUrlSnippetsData({
    snippets: [
      { id: "ok", shortcut: "ok", url: "https://example.com" },
      { id: "bad", shortcut: "bad", url: "javascript:alert(1)" },
    ],
  });
  Assert.deepEqual(
    stored.snippets.map(snippet => snippet.id),
    ["ok"],
    "Stored snippets with a disallowed scheme are dropped"
  );

  const seeded = normalizeUrlSnippetsData(undefined);
  Assert.equal(seeded.snippets[0].shortcut, "yt");
  Assert.equal(seeded.snippets[0].url, "https://youtube.com");
  Assert.deepEqual(
    normalizeUrlSnippetsData({ snippets: [] }).snippets,
    [],
    "An existing empty list stays empty"
  );
});
