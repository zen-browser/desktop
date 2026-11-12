/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

// A fake GitHub API for one repository, zen-tests/sample. Its files are in
// github/zen-tests/sample/<commit>/, served as they are.

const REPO = "repos/zen-tests/sample/";
const TREE_RE =
  /^repos\/zen-tests\/sample\/git\/trees\/([0-9a-f]{40})\?recursive=1$/;
const SHARED = [
  "theme.json",
  "userChrome.css",
  "main.uc.js",
  "assets/icon.svg",
];
const PAGES = [
  "pages/theme.json",
  "pages/chrome.css",
  "pages/userContent.css",
  "pages/parts/more.css",
];
// Page styles that reach the web in every way the check has to catch,
// and one that doesn't.
const REMOTE = [
  "remote/var-in-image-set/theme.json",
  "remote/var-in-image-set/userContent.css",
  "remote/charset/theme.json",
  "remote/charset/userContent.css",
  "remote/remote-image-scheme/theme.json",
  "remote/remote-image-scheme/userContent.css",
  "remote/data-import/theme.json",
  "remote/data-import/userContent.css",
  "remote/import-escape/theme.json",
  "remote/import-escape/userContent.css",
  "remote/import-escape/zen-themes.css",
  "remote/clean/a.png",
  "remote/clean/parts/ok.css",
  "remote/clean/theme.json",
  "remote/clean/userContent.css",
  "remote/escaped-string/theme.json",
  "remote/escaped-string/userContent.css",
  "remote/escaped-url/theme.json",
  "remote/escaped-url/userContent.css",
  "remote/image-set/theme.json",
  "remote/image-set/userContent.css",
  "remote/import-missing/theme.json",
  "remote/import-missing/userContent.css",
  "remote/import-no-space/theme.json",
  "remote/import-no-space/userContent.css",
  "remote/imported-encoded/parts/x.css",
  "remote/imported-encoded/theme.json",
  "remote/imported-encoded/userContent.css",
  "remote/imported-no-space/parts/x.css",
  "remote/imported-no-space/theme.json",
  "remote/imported-no-space/userContent.css",
];
// Listed, never downloaded: it's over the size a mod's file may have.
const HUGE = "assets/huge.png";
const SIZES = { [HUGE]: 3 * 1024 * 1024 };
const COMMITS = {
  ["a".repeat(40)]: [
    ...SHARED,
    ...PAGES,
    ...REMOTE,
    HUGE,
    "sub/chrome.css",
    ".github/ci.yml",
  ],
  ["b".repeat(40)]: SHARED,
  ["c".repeat(40)]: SHARED,
};

function handleRequest(request, response) {
  const query = decodeURIComponent(request.queryString);

  response.setHeader("Cache-Control", "no-store", false);

  // The tests move the default branch with ?head=<commit>.
  if (query.startsWith("head=")) {
    setState("zen-github-head", query.slice("head=".length));
    response.write("ok");
    return;
  }

  if (query.startsWith(`${REPO}commits/`)) {
    response.setHeader("Content-Type", "text/plain", false);
    response.write(getState("zen-github-head") || "a".repeat(40));
    return;
  }

  const tree = query.match(TREE_RE);

  if (tree && COMMITS[tree[1]]) {
    response.setHeader("Content-Type", "application/json", false);
    response.write(
      JSON.stringify({
        sha: tree[1],
        truncated: false,
        tree: COMMITS[tree[1]].map(path => ({
          path,
          type: "blob",
          size: SIZES[path] ?? 64,
        })),
      })
    );
    return;
  }

  response.setStatusLine(request.httpVersion, 404, "Not Found");
}
