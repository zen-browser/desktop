/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const { decideNetworkRequest, parseFilterList, shouldInspectNetworkRequest } =
  ChromeUtils.importESModule(
    "resource:///modules/zen/adblock/ZenAdblockPolicy.sys.mjs"
  );
const { isVideoAdRequest, rewriteVideoAdBody, shouldRewriteVideoAdResponse } =
  ChromeUtils.importESModule(
    "resource:///modules/zen/adblock/ZenAdblockVideo.sys.mjs"
  );
const { cacheNeedsRefresh, fetchFilterLists, gZenAdblock } =
  ChromeUtils.importESModule(
    "resource:///modules/zen/adblock/ZenAdblockManager.sys.mjs"
  );

const FIXTURE = [
  "||ads.example^",
  "@@||ads.example/allowed.js^",
  "news.example##.ad-slot",
].join("\n");

add_task(function test_filter_decisions() {
  const engine = parseFilterList(FIXTURE, "medium");

  const blocked = decideNetworkRequest({
    engine,
    level: "medium",
    url: "https://ads.example/banner.js",
    sourceUrl: "https://news.example/",
    type: "script",
  });
  Assert.equal(blocked.action, "cancel", "a listed ad script is blocked");

  const allowed = decideNetworkRequest({
    engine,
    level: "medium",
    url: "https://ads.example/allowed.js",
    sourceUrl: "https://news.example/",
    type: "script",
  });
  Assert.equal(allowed.action, "allow", "an exception filter allows the request");

  const heavy = decideNetworkRequest({
    engine,
    level: "heavy",
    url: "https://cdn.example/app.js",
    sourceUrl: "https://news.example/",
    type: "script",
  });
  Assert.equal(heavy.action, "cancel", "heavy blocks an unlisted third-party script");
  Assert.equal(heavy.reason, "heavy");

  const heavyException = decideNetworkRequest({
    engine,
    level: "heavy",
    url: "https://ads.example/allowed.js",
    sourceUrl: "https://news.example/",
    type: "script",
  });
  Assert.equal(
    heavyException.action,
    "allow",
    "an exception filter still allows a third-party script on Heavy"
  );

  const firstParty = decideNetworkRequest({
    engine,
    level: "heavy",
    url: "https://news.example/app.js",
    sourceUrl: "https://news.example/",
    type: "script",
  });
  Assert.equal(firstParty.action, "allow", "heavy still allows first-party scripts");

  const paused = decideNetworkRequest({
    engine,
    level: "off",
    url: "https://ads.example/banner.js",
    sourceUrl: "https://news.example/",
    type: "script",
  });
  Assert.equal(paused.action, "allow", "per-site off skips filtering");

  const cosmetics = engine.getCosmeticsFilters({
    url: "https://news.example/",
    hostname: "news.example",
    domain: "news.example",
    classes: ["ad-slot"],
    ids: [],
    hrefs: [],
    getInjectionRules: false,
    getExtendedRules: false,
    getBaseRules: true,
  });
  ok(
    cosmetics.styles.includes(".ad-slot"),
    "cosmetic filters hide the listed slot"
  );
});

add_task(function test_bootstrap_list_before_engine_is_ready() {
  const blocked = decideNetworkRequest({
    engine: null,
    level: "medium",
    url: "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js",
    sourceUrl: "https://news.example/",
    type: "script",
  });
  Assert.equal(blocked.action, "cancel");
  Assert.equal(blocked.reason, "bootstrap");

  const allowed = decideNetworkRequest({
    engine: null,
    level: "medium",
    url: "https://news.example/app.js",
    sourceUrl: "https://news.example/",
    type: "script",
  });
  Assert.equal(allowed.action, "allow");
});

add_task(function test_video_ad_requests_and_player_payloads() {
  const pagead = decideNetworkRequest({
    engine: null,
    level: "medium",
    url: "https://www.youtube.com/pagead/interaction",
    sourceUrl: "https://www.youtube.com/watch?v=abc",
    type: "xmlhttprequest",
  });
  Assert.equal(pagead.action, "cancel");
  Assert.equal(pagead.reason, "video-ad");

  const playback = decideNetworkRequest({
    engine: null,
    level: "medium",
    url: "https://rr3---sn.googlevideo.com/videoplayback?id=1",
    sourceUrl: "https://www.youtube.com/watch?v=abc",
    type: "media",
  });
  Assert.equal(playback.action, "allow", "video playback is not treated as an ad");

  const ima = decideNetworkRequest({
    engine: null,
    level: "light",
    url: "https://imasdk.googleapis.com/js/sdkloader/ima3.js",
    sourceUrl: "https://news.example/",
    type: "script",
  });
  Assert.equal(ima.action, "cancel");
  Assert.equal(ima.reason, "video-ad");

  ok(isVideoAdRequest("https://www.youtube.com/api/stats/ads?ver=2"));
  ok(!isVideoAdRequest("https://www.youtube.com/watch?v=abc"));
  ok(
    shouldRewriteVideoAdResponse(
      "https://www.youtube.com/youtubei/v1/player?prettyPrint=false",
      "application/json"
    )
  );
  ok(
    !shouldRewriteVideoAdResponse(
      "https://www.youtube.com/watch?v=abc",
      "text/html"
    ),
    "the watch document is left intact so player code keeps its property names"
  );
  Assert.equal(
    rewriteVideoAdBody('{"adPlacements":[],"adSlots":[],"playerAds":{}}'),
    '{"no_ads":[],"no_ads":[],"no_ads":{}}'
  );

  const paused = decideNetworkRequest({
    engine: null,
    level: "off",
    url: "https://www.youtube.com/pagead/interaction",
    sourceUrl: "https://www.youtube.com/watch?v=abc",
    type: "xmlhttprequest",
  });
  Assert.equal(paused.action, "allow", "per-site off still allows video ad URLs");
});

add_task(function test_per_site_override_uses_base_domain() {
  const url = "https://www.example.com/article";
  gZenAdblock.setOverride(url, "off");
  Assert.equal(gZenAdblock.getOverride("https://example.com/"), "off");
  Assert.equal(gZenAdblock.getEffectiveLevel(url), "off");

  gZenAdblock.setOverride(url, "heavy");
  Assert.equal(gZenAdblock.getEffectiveLevel("https://example.com/other"), "heavy");

  gZenAdblock.setOverride(url, null);
  Assert.equal(gZenAdblock.getOverride(url), null);
  Assert.equal(
    gZenAdblock.getEffectiveLevel(url),
    gZenAdblock.getGlobalLevel(),
    "clearing the override falls back to the global level"
  );
});

add_task(function test_network_hot_path_skips_cheap_requests() {
  Assert.equal(
    shouldInspectNetworkRequest({
      type: "main_frame",
      isSystem: false,
      requestHost: "example.com",
      sourceHost: "",
    }),
    false,
    "top-level documents skip the filter engine"
  );
  Assert.equal(
    shouldInspectNetworkRequest({
      type: "image",
      isSystem: true,
      requestHost: "example.com",
      sourceHost: "example.com",
    }),
    false,
    "system-triggered loads skip the filter engine"
  );
  Assert.equal(
    shouldInspectNetworkRequest({
      type: "image",
      isSystem: false,
      requestHost: "news.example",
      sourceHost: "news.example",
    }),
    false,
    "first-party images skip the filter engine"
  );
  Assert.equal(
    shouldInspectNetworkRequest({
      type: "script",
      isSystem: false,
      requestHost: "news.example",
      sourceHost: "news.example",
    }),
    true,
    "first-party scripts are still inspected"
  );
  Assert.equal(
    shouldInspectNetworkRequest({
      type: "script",
      isSystem: false,
      requestHost: "ads.example",
      sourceHost: "news.example",
    }),
    true,
    "third-party scripts are inspected"
  );
});

add_task(function test_partial_list_cache_retries_after_an_hour() {
  const now = Date.now();
  const hour = 60 * 60 * 1000;
  const interval = 4 * 24 * hour;
  Assert.equal(
    cacheNeedsRefresh({ updatedAt: now - hour }, now, interval),
    false,
    "a cache with no complete field waits out the normal interval"
  );
  Assert.equal(
    cacheNeedsRefresh({ updatedAt: now - hour, complete: false }, now, interval),
    false,
    "a partial cache is kept for the first hour"
  );
  Assert.equal(
    cacheNeedsRefresh(
      { updatedAt: now - hour - 1, complete: false },
      now,
      interval
    ),
    true,
    "a partial cache retries after an hour"
  );
  Assert.equal(
    cacheNeedsRefresh({ updatedAt: now - 5 * 24 * hour, complete: true }, now, interval),
    true,
    "a complete cache refreshes after the update interval"
  );
});

add_task(async function test_filter_lists_download_together() {
  let started = 0;
  let release;
  const gate = new Promise(resolve => {
    release = resolve;
  });
  const pending = fetchFilterLists(["a", "b", "c"], async url => {
    started++;
    await gate;
    if (url === "b") {
      throw new Error("missing");
    }
    return `list ${url}`;
  });
  await TestUtils.waitForCondition(
    () => started === 3,
    "every list download starts before the first one finishes"
  );
  release();
  const result = await pending;
  Assert.equal(result.complete, false, "a failed list marks the cache incomplete");
  Assert.deepEqual(result.texts, ["list a", "list c"], "successful lists keep their order");
});
