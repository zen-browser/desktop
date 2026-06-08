/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

// Throughput benchmarks for the routing hot path. These run on every match
// against tab creation and (now) in-place navigation, so a perf regression here
// is felt browser-wide.
//
// The numbers are logged via info(); the assertions are deliberately generous
// hang-guards (catch catastrophic regressions / ReDoS) rather than tight perf
// gates, so the test stays non-flaky across machines.

function bench(label, iterations, fn) {
  // Warm up so JIT state doesn't skew the first timed run.
  const warmup = Math.min(iterations, 200);
  for (let i = 0; i < warmup; i++) {
    fn(i);
  }

  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    fn(i);
  }
  const ms = performance.now() - start;
  const opsPerSec = ms > 0 ? Math.round((iterations / ms) * 1000) : Infinity;

  info(
    `[bench] ${label}: ${iterations} ops in ${ms.toFixed(1)}ms ` +
      `→ ${opsPerSec.toLocaleString()} ops/sec`
  );
  return { ms, opsPerSec };
}

function populate(count, makeRoute) {
  clearAllRoutes();
  for (let i = 0; i < count; i++) {
    addRoute(makeRoute(i));
  }
}

add_setup(async function () {
  clearAllRoutes();
  registerCleanupFunction(() => clearAllRoutes());
});

add_task(async function bench_contains_realistic() {
  populate(30, i => ({
    reference: `site-${i}.example.com`,
    openIn: i % 2 ? "ws-a" : "most-recent-space",
    matchType: "contains",
  }));

  // ~half hit an early route, ~half fall through the whole list.
  const { ms } = bench("routeUri / 30 contains routes", 5000, i =>
    gZenSpaceRoutingManager.routeUri(
      `https://site-${i % 60}.example.com/path`,
      {
        fromExternal: false,
      }
    )
  );

  Assert.less(ms, 15000, "Realistic contains routing finishes promptly");
});

add_task(async function bench_worst_case_no_match_scan() {
  // No URL matches, so every call scans (and structuredClones) the full list.
  populate(200, i => ({
    reference: `never-match-${i}.invalid`,
    openIn: "ws-a",
    matchType: "contains",
  }));

  const { ms } = bench(
    "routeUri / 200 routes, 0 matches (full scan)",
    5000,
    i =>
      gZenSpaceRoutingManager.routeUri(`https://unrelated-${i}.test/page`, {
        fromExternal: false,
      })
  );

  Assert.less(ms, 20000, "Worst-case full-scan routing does not blow up");
});

add_task(async function bench_equal_to() {
  populate(100, i => ({
    reference: `https://exact-${i}.example.com`,
    openIn: "ws-a",
    matchType: "equal-to",
  }));

  const { ms } = bench("routeUri / 100 equal-to routes", 5000, i =>
    gZenSpaceRoutingManager.routeUri(`https://exact-${i % 120}.example.com`, {
      fromExternal: false,
    })
  );

  Assert.less(ms, 15000, "equal-to routing finishes promptly");
});

add_task(async function bench_regex() {
  populate(50, i => ({
    reference: `^https?://(www\\.)?host-${i}\\.example\\.(com|org)/`,
    openIn: "ws-a",
    matchType: "regex",
  }));

  const { ms } = bench("routeUri / 50 regex routes", 3000, i =>
    gZenSpaceRoutingManager.routeUri(`https://host-${i % 70}.example.com/x`, {
      fromExternal: false,
    })
  );

  Assert.less(ms, 15000, "regex routing finishes promptly");
});

add_task(async function bench_redos_resilience() {
  // A user can author an arbitrary regex rule. This probes how the routing path
  // copes with a classic catastrophic-backtracking pattern against a non-match.
  // It is informational (the time is logged) with a generous hang-guard so a
  // truly pathological case surfaces as a failure instead of wedging the suite.
  clearAllRoutes();
  addRoute({
    reference: "^(a+)+$",
    openIn: "ws-a",
    matchType: "regex",
  });

  const evilInput = "a".repeat(26) + "!";
  const start = performance.now();
  const result = gZenSpaceRoutingManager.routeUri(evilInput, {
    fromExternal: false,
  });
  const ms = performance.now() - start;

  info(
    `[bench] ReDoS probe ("^(a+)+$" vs ${evilInput.length} chars): ${ms.toFixed(1)}ms`
  );

  is(typeof result, "string", "ReDoS probe still returns a valid destination");
  Assert.less(
    ms,
    8000,
    "Pathological regex rule must not hang the routing path " +
      "(consider bounding user-supplied regex if this fails)"
  );

  clearAllRoutes();
});
