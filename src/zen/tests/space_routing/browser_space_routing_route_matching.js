/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_task(async function test_contains_is_case_insensitive_substring() {
  const route = { reference: "GitHub", matchType: "contains" };

  ok(
    gZenSpaceRoutingManager.isRouteMatching("https://github.com/zen", route),
    "'contains' matches a substring regardless of case"
  );
  ok(
    gZenSpaceRoutingManager.isRouteMatching("https://api.GITHUB.com/v3", route),
    "'contains' matches when the URL casing differs from the reference"
  );
  ok(
    !gZenSpaceRoutingManager.isRouteMatching("https://gitlab.com/zen", route),
    "'contains' rejects a URL that does not include the reference"
  );
});

add_task(async function test_domain_contains_only_looks_at_the_host() {
  const route = { reference: "Mozilla", matchType: "domain-contains" };

  ok(
    gZenSpaceRoutingManager.isRouteMatching("https://app.mozilla.org/x", route),
    "'domain-contains' matches a substring of the host, including subdomains"
  );
  ok(
    !gZenSpaceRoutingManager.isRouteMatching(
      "https://github.com/mozilla/desktop",
      route
    ),
    "'domain-contains' ignores the reference appearing in the path"
  );
  ok(
    !gZenSpaceRoutingManager.isRouteMatching(
      "https://example.com/?q=mozilla#mozilla",
      route
    ),
    "'domain-contains' ignores the query and the hash"
  );
  ok(
    !gZenSpaceRoutingManager.isRouteMatching("https://www.github.com", {
      reference: "www",
      matchType: "domain-contains",
    }),
    "'domain-contains' drops a leading www. from the host"
  );
});

add_task(async function test_path_contains_only_looks_at_the_pathname() {
  const route = { reference: "Mozilla", matchType: "path-contains" };

  ok(
    gZenSpaceRoutingManager.isRouteMatching(
      "https://github.com/MOZILLA/desktop",
      route
    ),
    "'path-contains' matches a substring of the pathname regardless of case"
  );
  ok(
    !gZenSpaceRoutingManager.isRouteMatching("https://mozilla.org/", route),
    "'path-contains' ignores the reference appearing in the host"
  );
  ok(
    !gZenSpaceRoutingManager.isRouteMatching(
      "https://example.com/search?q=mozilla#mozilla",
      route
    ),
    "'path-contains' ignores the query and the hash"
  );
});

add_task(async function test_url_part_match_types_reject_unparseable_urls() {
  for (const matchType of ["domain-contains", "path-contains"]) {
    ok(
      !gZenSpaceRoutingManager.isRouteMatching("not a url mozilla", {
        reference: "mozilla",
        matchType,
      }),
      `An unparseable URL never matches (${matchType})`
    );
  }
});

add_task(async function test_equal_to_normalizes_protocol_and_www() {
  const route = { reference: "github.com", matchType: "equal-to" };

  ok(
    gZenSpaceRoutingManager.isRouteMatching("https://www.github.com/", route),
    "'equal-to' ignores https://, www. and a trailing slash"
  );
  ok(
    gZenSpaceRoutingManager.isRouteMatching("HTTP://GitHub.com", route),
    "'equal-to' is case-insensitive and strips http://"
  );
  ok(
    !gZenSpaceRoutingManager.isRouteMatching("https://github.com/zen", route),
    "'equal-to' does not match when a path is present (not an exact host)"
  );
  ok(
    !gZenSpaceRoutingManager.isRouteMatching("https://notgithub.com", route),
    "'equal-to' requires the whole normalized URL to be equal"
  );
});

add_task(async function test_regex_match_is_case_sensitive_on_raw_uri() {
  ok(
    gZenSpaceRoutingManager.isRouteMatching("https://zen-browser.app", {
      reference: "^https://.*\\.app$",
      matchType: "regex",
    }),
    "'regex' matches against the raw URI"
  );

  ok(
    gZenSpaceRoutingManager.isRouteMatching("https://github.com", {
      reference: "GitHub",
      matchType: "regex",
    }),
    "'regex' is case-insensitive (no implicit lower-casing like 'contains')"
  );
});

add_task(async function test_invalid_regex_is_swallowed() {
  let threw = false;
  let result;
  try {
    result = gZenSpaceRoutingManager.isRouteMatching(
      "https://zen-browser.app",
      {
        reference: "([",
        matchType: "regex",
      }
    );
  } catch (e) {
    threw = true;
  }

  ok(!threw, "An invalid regex does not throw out of isRouteMatching");
  Assert.strictEqual(result, false, "An invalid regex never matches");
});

add_task(async function test_empty_reference_never_matches() {
  for (const matchType of [
    "contains",
    "domain-contains",
    "path-contains",
    "equal-to",
    "regex",
  ]) {
    ok(
      !gZenSpaceRoutingManager.isRouteMatching("https://github.com", {
        reference: "",
        matchType,
      }),
      `An empty reference never matches (${matchType})`
    );
    ok(
      !gZenSpaceRoutingManager.isRouteMatching("https://github.com", {
        reference: "   ",
        matchType,
      }),
      `A whitespace-only reference never matches (${matchType})`
    );
  }
});

add_task(async function test_unknown_match_type_does_not_match() {
  ok(
    !gZenSpaceRoutingManager.isRouteMatching("https://github.com", {
      reference: "github.com",
      matchType: "starts-with",
    }),
    "An unsupported match type falls through to no match"
  );
});
