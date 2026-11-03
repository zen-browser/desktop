/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

if (SpecialPowers.useRemoteSubframes) {
  requestLongerTimeout(2);
}

const DEFAULT_PROCESS_COUNT = Services.prefs
  .getDefaultBranch(null)
  .getIntPref("dom.ipc.processCount");

/**
 * A test that checks whether any preference getter from the given list
 * of stats was called more often than the max parameter.
 *
 * @param {Array}  stats - an array of [prefName, accessCount] tuples
 * @param {number} max - the maximum number of times any of the prefs should
 *                 have been called.
 * @param {object} knownProblematicPrefs (optional) - an object that defines
 *                 prefs that should be exempt from checking the
 *                 maximum access. It looks like the following:
 *
 *                 pref_name: {
 *                   min: [Number] the minimum amount of times this should have
 *                                 been called (to avoid keeping around dead items)
 *                   max: [Number] the maximum amount of times this should have
 *                                 been called (to avoid this creeping up further)
 *                 }
 */
function checkPrefGetters(stats, max, knownProblematicPrefs = {}) {
  let getterStats = Object.entries(stats).sort(
    ([, val1], [, val2]) => val2 - val1
  );

  // Clone the list to be able to delete entries to check if we
  // forgot any later on.
  knownProblematicPrefs = Object.assign({}, knownProblematicPrefs);

  for (let [pref, count] of getterStats) {
    let prefLimits = knownProblematicPrefs[pref];
    if (!prefLimits) {
      Assert.lessOrEqual(
        count,
        max,
        `${pref} should not be accessed more than ${max} times.`
      );
    } else {
      // Still record how much this pref was accessed even if we don't do any real assertions.
      if (!prefLimits.min && !prefLimits.max) {
        info(
          `${pref} should not be accessed more than ${max} times and was accessed ${count} times.`
        );
      }

      if (prefLimits.min) {
        Assert.lessOrEqual(
          prefLimits.min,
          count,
          `${pref} should be accessed at least ${prefLimits.min} times.`
        );
      }
      if (prefLimits.max) {
        Assert.lessOrEqual(
          count,
          prefLimits.max,
          `${pref} should be accessed at most ${prefLimits.max} times.`
        );
      }
      delete knownProblematicPrefs[pref];
    }
  }

  let unusedPrefs = Object.keys(knownProblematicPrefs);
  is(
    unusedPrefs.length,
    0,
    `Should have accessed all known problematic prefs. Remaining: ${unusedPrefs}`
  );
}

/**
 * A helper function to read preference access data
 * using the Services.prefs.readStats() function.
 */
function getPreferenceStats() {
  let stats = {};
  Services.prefs.readStats((key, value) => (stats[key] = value));
  return stats;
}

add_task(async function debug_only() {
  ok(AppConstants.DEBUG, "You need to run this test on a debug build.");
});

// Just checks how many prefs were accessed during startup.
add_task(async function startup() {
  let max = 40;

  let knownProblematicPrefs = {
    "network.loadinfo.skip_type_assertion": {
      // This is accessed in debug only.
    },
  };

  let startupRecorder =
    Cc["@mozilla.org/test/startuprecorder;1"].getService().wrappedJSObject;
  await startupRecorder.done;

  ok(startupRecorder.data.prefStats, "startupRecorder has prefStats");

  checkPrefGetters(startupRecorder.data.prefStats, max, knownProblematicPrefs);
});

// This opens 10 tabs and checks pref getters.
add_task(async function open_10_tabs() {
  // This is somewhat arbitrary. When we had a default of 4 content processes
  // the value was 15. We need to scale it as we increase the number of
  // content processes so we approximate with 4 * process_count.
  const max = 4 * DEFAULT_PROCESS_COUNT;

  let knownProblematicPrefs = {
    "browser.tabs.remote.logSwitchTiming": {
      max: 35,
    },
    "network.loadinfo.skip_type_assertion": {
      // This is accessed in debug only.
    },
  };

  Services.prefs.resetStats();

  let tabs = [];
  while (tabs.length < 10) {
    tabs.push(
      await BrowserTestUtils.openNewForegroundTab(
        gBrowser,
        // eslint-disable-next-line sdl/no-insecure-url
        "http://example.com",
        true,
        true
      )
    );
  }

  for (let tab of tabs) {
    await BrowserTestUtils.removeTab(tab);
  }

  checkPrefGetters(getPreferenceStats(), max, knownProblematicPrefs);
});

// This navigates to 50 sites and checks pref getters.
add_task(async function navigate_around() {
  await SpecialPowers.pushPrefEnv({
    set: [
      // Disable bfcache so that we can measure more accurately the number of
      // pref accesses in the child processes.
      // If bfcache is enabled on Fission
      // security.sandbox.content.force-namespace is accessed only a couple of
      // times.
      ["browser.sessionhistory.max_total_viewers", 0],
    ],
  });

  let max = 40;

  let knownProblematicPrefs = {
    "network.loadinfo.skip_type_assertion": {
      // This is accessed in debug only.
    },
  };

  if (SpecialPowers.useRemoteSubframes) {
    // We access this when considering starting a new content process.
    // Because there is no complete list of content process types,
    // caching this is not trivial. Opening 50 different content
    // processes and throwing them away immediately is a bit artificial;
    // we're more likely to keep some around so this shouldn't be quite
    // this bad in practice. Fixing this is
    // https://bugzilla.mozilla.org/show_bug.cgi?id=1600266
    knownProblematicPrefs["dom.ipc.processCount.webIsolated"] = {
      min: 50,
      max: 51,
    };
    if (AppConstants.platform == "linux") {
      // The following sandbox pref is covered by
      // https://bugzilla.mozilla.org/show_bug.cgi?id=1600189
      knownProblematicPrefs["security.sandbox.content.force-namespace"] = {
        min: 45,
        max: 55,
      };
    } else if (AppConstants.platform == "win") {
      // The following 2 graphics prefs are covered by
      // https://bugzilla.mozilla.org/show_bug.cgi?id=1639497
      knownProblematicPrefs["gfx.canvas.azure.backends"] = {
        min: 90,
        max: 110,
      };
      knownProblematicPrefs["gfx.content.azure.backends"] = {
        min: 90,
        max: 110,
      };
      // The following 2 sandbox prefs are covered by
      // https://bugzilla.mozilla.org/show_bug.cgi?id=1639494
      knownProblematicPrefs["security.sandbox.content.read_path_whitelist"] = {
        min: 47,
        max: 55,
      };
      knownProblematicPrefs["security.sandbox.logging.enabled"] = {
        min: 47,
        max: 55,
      };
    }
  }

  Services.prefs.resetStats();

  let tab = await BrowserTestUtils.openNewForegroundTab(
    gBrowser,
    // eslint-disable-next-line sdl/no-insecure-url
    "http://example.com",
    true,
    true
  );

  let urls = [
    // eslint-disable-next-line sdl/no-insecure-url
    "http://example.com/",
    "https://example.com/",
    // eslint-disable-next-line sdl/no-insecure-url
    "http://example.org/",
    "https://example.org/",
  ];

  for (let i = 0; i < 50; i++) {
    let url = urls[i % urls.length];
    info(`Navigating to ${url}...`);
    BrowserTestUtils.startLoadingURIString(tab.linkedBrowser, url);
    await BrowserTestUtils.browserLoaded(tab.linkedBrowser, false, url);
    info(`Loaded ${url}.`);
  }

  await BrowserTestUtils.removeTab(tab);

  checkPrefGetters(getPreferenceStats(), max, knownProblematicPrefs);
});
