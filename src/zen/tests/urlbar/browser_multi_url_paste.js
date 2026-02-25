"use strict";

add_setup(async function setup_multi_url_paste_tests() {
  await SpecialPowers.pushPrefEnv({
    set: [["browser.tabs.maxOpenBeforeWarn", 999]],
  });
});

registerCleanupFunction(async function cleanup_multi_url_paste_tests() {
  await SpecialPowers.popPrefEnv();
});

function getOpenedTabs(initialTabs) {
  return Array.from(gBrowser.tabs).filter((tab) => !initialTabs.has(tab));
}

function cleanupTabs(tabs) {
  for (const tab of tabs) {
    if (tab?.isConnected && !tab.closing) {
      gBrowser.removeTab(tab);
    }
  }
}

// Test extractMultipleUrls

add_task(async function test_extract_whitespace_separated() {
  let result = gZenUIManager.extractMultipleUrls("https://example.com https://mozilla.org");
  Assert.deepEqual(result, ["https://example.com", "https://mozilla.org"]);
});

add_task(async function test_extract_newline_separated() {
  let result = gZenUIManager.extractMultipleUrls("https://example.com\nhttps://mozilla.org");
  Assert.deepEqual(result, ["https://example.com", "https://mozilla.org"]);
});

add_task(async function test_extract_bare_domains() {
  let result = gZenUIManager.extractMultipleUrls("example.com mozilla.org");
  Assert.deepEqual(result, ["https://example.com", "https://mozilla.org"]);
});

add_task(async function test_extract_mixed_protocols() {
  let result = gZenUIManager.extractMultipleUrls("https://a.com http://b.com");
  Assert.deepEqual(result, ["https://a.com", "http://b.com"]);
});

add_task(async function test_extract_comma_separated() {
  let result = gZenUIManager.extractMultipleUrls("https://a.com, https://b.com, https://c.com");
  Assert.deepEqual(result, ["https://a.com", "https://b.com", "https://c.com"]);
});

add_task(async function test_extract_preserves_wikipedia_parens() {
  let result = gZenUIManager.extractMultipleUrls(
    "https://en.wikipedia.org/wiki/Zen_(disambiguation) https://mozilla.org"
  );
  Assert.deepEqual(result, [
    "https://en.wikipedia.org/wiki/Zen_(disambiguation)",
    "https://mozilla.org",
  ]);
});

add_task(async function test_extract_deduplicates() {
  let result = gZenUIManager.extractMultipleUrls("https://example.com https://example.com");
  Assert.deepEqual(result, ["https://example.com"]);
});

add_task(async function test_extract_single_url_returns_one() {
  let result = gZenUIManager.extractMultipleUrls("https://example.com");
  Assert.equal(result.length, 1);
});

add_task(async function test_extract_empty_input() {
  Assert.deepEqual(gZenUIManager.extractMultipleUrls(""), []);
  Assert.deepEqual(gZenUIManager.extractMultipleUrls(null), []);
});

add_task(async function test_extract_caps_at_100kb() {
  let longInput = "https://example.com ".repeat(10000);
  let result = gZenUIManager.extractMultipleUrls(longInput);
  ok(result.length > 0, "Should parse URLs from capped input");
});

// Test isUrlSafeToOpen

add_task(async function test_safe_https() {
  ok(gZenUIManager.isUrlSafeToOpen("https://example.com"), "https is safe");
});

add_task(async function test_safe_http() {
  ok(gZenUIManager.isUrlSafeToOpen("http://example.com"), "http is safe");
});

add_task(async function test_blocks_ftp() {
  ok(!gZenUIManager.isUrlSafeToOpen("ftp://files.example.com"), "ftp is blocked");
});

add_task(async function test_blocks_file() {
  ok(!gZenUIManager.isUrlSafeToOpen("file:///tmp/test.html"), "file:// is blocked");
});

add_task(async function test_blocks_javascript() {
  ok(!gZenUIManager.isUrlSafeToOpen("javascript:alert(1)"), "javascript: is blocked");
});

add_task(async function test_blocks_data() {
  ok(!gZenUIManager.isUrlSafeToOpen("data:text/html,<h1>hi</h1>"), "data: is blocked");
});

add_task(async function test_blocks_about() {
  ok(!gZenUIManager.isUrlSafeToOpen("about:config"), "about: is blocked");
});

add_task(async function test_invalid_url() {
  ok(!gZenUIManager.isUrlSafeToOpen("not a url at all"), "Invalid URL returns false");
});

// Test maybeOpenMultipleUrls

add_task(async function test_single_url_not_handled() {
  let result = gZenUIManager.maybeOpenMultipleUrls("https://example.com");
  Assert.equal(result, false, "Single URL should not be handled");
});

add_task(async function test_opens_multiple_tabs() {
  const initialTabs = new Set(gBrowser.tabs);
  let openedTabs = [];
  try {
    let result = gZenUIManager.maybeOpenMultipleUrls("https://example.com https://mozilla.org");
    openedTabs = getOpenedTabs(initialTabs);
    Assert.equal(result, true, "Multiple URLs should be handled");
    Assert.greaterOrEqual(openedTabs.length, 2, "Should have opened at least 2 tabs");
  } finally {
    cleanupTabs(openedTabs);
  }
});

add_task(async function test_opens_multiple_bare_domains_tabs() {
  const initialTabs = new Set(gBrowser.tabs);
  let openedTabs = [];
  try {
    let result = gZenUIManager.maybeOpenMultipleUrls("example.com mozilla.org");
    openedTabs = getOpenedTabs(initialTabs);
    Assert.equal(result, true, "Multiple bare domains should be handled");
    Assert.greaterOrEqual(openedTabs.length, 2, "Should have opened at least 2 tabs");
  } finally {
    cleanupTabs(openedTabs);
  }
});

add_task(async function test_limits_to_max_tabs() {
  let urls = Array.from({ length: 25 }, (_, i) => `https://example${i}.com`);
  const initialTabs = new Set(gBrowser.tabs);
  let openedTabs = [];
  try {
    let result = gZenUIManager.maybeOpenMultipleUrls(urls.join(" "));
    openedTabs = getOpenedTabs(initialTabs);
    Assert.equal(result, true, "URL list should be handled");
    Assert.lessOrEqual(
      openedTabs.length,
      gZenUIManager.MAX_TABS_FROM_PASTE,
      "Should cap at MAX_TABS_FROM_PASTE"
    );
  } finally {
    cleanupTabs(openedTabs);
  }
});

add_task(async function test_filters_dangerous_schemes() {
  let result = gZenUIManager.maybeOpenMultipleUrls("https://safe.com javascript:alert(1)");
  Assert.equal(result, false, "Only 1 safe URL, should not handle");
});

add_task(async function test_ignores_non_url_text() {
  let result = gZenUIManager.maybeOpenMultipleUrls("compare github.com and gitlab.com");
  Assert.equal(result, false, "Input with non-URL text should not be handled");
});

add_task(async function test_filters_multi_safe_plus_dangerous() {
  let result = gZenUIManager.maybeOpenMultipleUrls(
    "https://a.com https://b.com javascript:alert(1)"
  );
  Assert.equal(result, false, "Any dangerous URL rejects entire input");
});

// Direct isLikelyMultiUrlInput tests

add_task(async function test_likely_rejects_all_separators() {
  ok(
    !gZenUIManager.isLikelyMultiUrlInput("1. 2. 3."),
    "Only separators and no URLs returns false"
  );
});

add_task(async function test_likely_rejects_single_url_with_separator() {
  ok(
    !gZenUIManager.isLikelyMultiUrlInput("1. https://example.com"),
    "One URL plus separators needs at least 2 URLs"
  );
});

add_task(async function test_likely_rejects_mixed_text_and_urls() {
  ok(
    !gZenUIManager.isLikelyMultiUrlInput("check https://a.com and https://b.com"),
    "Plain-text words cause rejection"
  );
});

add_task(async function test_likely_accepts_numbered_list() {
  ok(
    gZenUIManager.isLikelyMultiUrlInput("1. https://a.com\n2. https://b.com"),
    "Numbered list with valid URLs is accepted"
  );
});

add_task(async function test_likely_accepts_lettered_list() {
  ok(
    gZenUIManager.isLikelyMultiUrlInput("a) example.com\nb) mozilla.org"),
    "Lettered list separators are recognised"
  );
});

add_task(async function test_likely_accepts_comma_separated() {
  ok(
    gZenUIManager.isLikelyMultiUrlInput("https://a.com, https://b.com"),
    "Comma-separated URLs are accepted"
  );
});
