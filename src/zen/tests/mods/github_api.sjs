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
const COMMITS = {
  ["a".repeat(40)]: [...SHARED, "sub/chrome.css", ".github/ci.yml"],
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
        tree: COMMITS[tree[1]].map(path => ({ path, type: "blob", size: 64 })),
      })
    );
    return;
  }

  response.setStatusLine(request.httpVersion, 404, "Not Found");
}
