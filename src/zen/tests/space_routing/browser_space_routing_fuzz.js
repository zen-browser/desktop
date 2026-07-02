/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

// Seeded fuzzing for the pure routing decision functions. The point is not to
// assert a particular routing outcome but to prove robustness invariants under
// adversarial input: the functions must never throw, must always return the
// declared type, and routeUri must only ever return a value it is allowed to.
//
// The RNG is seeded so any failure is reproducible: re-run with the logged seed.

const FUZZ_SEED = 0x5eed1234;

// mulberry32 — small, fast, deterministic PRNG.
function makeRng(seed) {
  let s = seed >>> 0;
  return function rng() {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DOMAIN_CHARS = "abcdefghijklmnopqrstuvwxyz0123456789-.";
const REGEX_CHARS = ".*+?^${}()|[]\\" + DOMAIN_CHARS;
const TRICKY_CHARS =
  DOMAIN_CHARS + "%/?#:@!$&'()*+,;= []{}<>\"\\^`|~\tünïçødé日本語🚀";
const SCHEMES = [
  "http://",
  "https://",
  "ftp://",
  "file://",
  "about:",
  "data:text/plain,",
  "javascript:",
  "//",
  "",
];
const MATCH_TYPES = ["contains", "equal-to", "regex", "bogus-type", ""];

function randInt(rng, n) {
  return Math.floor(rng() * n);
}
function pick(rng, arr) {
  return arr[randInt(rng, arr.length)];
}
function randString(rng, maxLen, charset) {
  const len = randInt(rng, maxLen + 1);
  let out = "";
  for (let i = 0; i < len; i++) {
    out += charset[randInt(rng, charset.length)];
  }
  return out;
}

function randomUrl(rng) {
  const scheme = pick(rng, SCHEMES);
  const host = randString(rng, 30, DOMAIN_CHARS + "ünïçødé");
  const port = rng() < 0.2 ? ":" + randInt(rng, 99999) : "";
  const path = rng() < 0.7 ? "/" + randString(rng, 40, TRICKY_CHARS) : "";
  return scheme + host + port + path;
}

function randomReference(rng) {
  switch (randInt(rng, 5)) {
    case 0:
      return "";
    case 1:
      return "   ";
    case 2:
      return randString(rng, 30, DOMAIN_CHARS);
    case 3:
      // Deliberately regex-flavoured to exercise the "regex" match path.
      return randString(rng, 20, REGEX_CHARS);
    default:
      return randString(rng, 50, TRICKY_CHARS);
  }
}

function randomRoute(rng, openIn = "most-recent-space") {
  return {
    id: "fuzz-" + randInt(rng, 1e9),
    reference: randomReference(rng),
    openIn,
    matchType: pick(rng, MATCH_TYPES),
  };
}

add_setup(async function () {
  clearAllRoutes();
  registerCleanupFunction(() => clearAllRoutes());
  info(`Space Routing fuzz seed: 0x${FUZZ_SEED.toString(16)}`);
});

add_task(async function fuzz_isRouteMatching_never_throws() {
  const rng = makeRng(FUZZ_SEED);
  const ITERATIONS = 5000;

  for (let i = 0; i < ITERATIONS; i++) {
    const url = randomUrl(rng);
    const route = randomRoute(rng);

    let result;
    try {
      result = gZenSpaceRoutingManager.isRouteMatching(url, route);
    } catch (e) {
      ok(
        false,
        `isRouteMatching threw on url=${JSON.stringify(
          url
        )} route=${JSON.stringify(route)}: ${e}`
      );
      continue;
    }

    is(
      typeof result,
      "boolean",
      `isRouteMatching must return a boolean (iter ${i})`
    );

    // An empty / whitespace reference can never match.
    if (typeof route.reference !== "string" || route.reference.trim() === "") {
      ok(!result, "Empty reference never matches");
    }
  }
});

add_task(async function fuzz_routeUri_returns_only_valid_destinations() {
  const rng = makeRng(FUZZ_SEED ^ 0x1111);
  clearAllRoutes();

  // Populate the manager with a mix of routes pointing at a few destinations.
  const destinations = ["most-recent-space", "ws-a", "ws-b", "ws-c"];
  for (let i = 0; i < 200; i++) {
    const r = randomRoute(rng, pick(rng, destinations));
    addRoute({
      reference: r.reference,
      openIn: r.openIn,
      matchType: r.matchType,
    });
  }

  const allowed = new Set(
    gZenSpaceRoutingManager.getAllRoutes().map(r => r.openIn)
  );
  allowed.add("most-recent-space");
  const defaultExternal = gZenSpaceRoutingManager.getDefaultExternalRoute();
  allowed.add(defaultExternal);

  const ITERATIONS = 4000;
  for (let i = 0; i < ITERATIONS; i++) {
    const url = randomUrl(rng);
    const fromExternal = rng() < 0.5;

    let result;
    try {
      result = gZenSpaceRoutingManager.routeUri(url, { fromExternal });
    } catch (e) {
      ok(false, `routeUri threw on url=${JSON.stringify(url)}: ${e}`);
      continue;
    }

    is(typeof result, "string", `routeUri must return a string (iter ${i})`);
    ok(
      allowed.has(result),
      `routeUri returned an out-of-set destination: ${JSON.stringify(result)}`
    );
  }

  clearAllRoutes();
});

add_task(async function fuzz_shouldRedirectNavigation_invariants() {
  const rng = makeRng(FUZZ_SEED ^ 0x2222);
  clearAllRoutes();

  const workspaces = [
    { uuid: "ws-a", containerTabId: 1 },
    { uuid: "ws-b", containerTabId: 2 },
  ];
  const win = makeFakeWindow({ workspaces });

  for (let i = 0; i < 120; i++) {
    const r = randomRoute(
      rng,
      pick(rng, ["ws-a", "ws-b", "most-recent-space"])
    );
    addRoute({
      reference: r.reference,
      openIn: r.openIn,
      matchType: r.matchType,
    });
  }

  const ITERATIONS = 4000;
  const currentChoices = ["ws-a", "ws-b", "ws-other", "", null];

  for (let i = 0; i < ITERATIONS; i++) {
    const url = randomUrl(rng);
    const currentWorkspaceId = pick(rng, currentChoices);

    let result;
    try {
      result = gZenSpaceRoutingManager.shouldRedirectNavigation(
        url,
        currentWorkspaceId,
        win
      );
    } catch (e) {
      ok(
        false,
        `shouldRedirectNavigation threw on url=${JSON.stringify(url)}: ${e}`
      );
      continue;
    }

    is(typeof result, "boolean", "shouldRedirectNavigation returns a boolean");

    if (result) {
      // If we decided to redirect, the target must be a real, *different* space.
      const target = gZenSpaceRoutingManager.routeUri(url, {
        fromExternal: false,
      });
      ok(
        target !== "most-recent-space" && target !== currentWorkspaceId,
        `Redirect target must differ from current space (url=${url})`
      );
      ok(
        !!win.gZenWorkspaces.getWorkspaceFromId(target),
        "Redirect target must be an existing workspace"
      );
    }
  }

  clearAllRoutes();
});
