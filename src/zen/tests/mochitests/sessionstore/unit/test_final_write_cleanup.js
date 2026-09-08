"use strict";

/**
 * This test ensures that we correctly clean up the session state when
 * writing with isFinalWrite, which is used on shutdown. It tests that each
 * tab's shistory is capped to a maximum number of preceding and succeeding
 * entries.
 */

const { SessionWriter } = ChromeUtils.importESModule(
  "resource:///modules/sessionstore/SessionWriter.sys.mjs"
);

// Make sure that we have a profile before initializing SessionFile.
do_get_profile();
const {
  SessionFile: { Paths },
} = ChromeUtils.importESModule(
  "resource:///modules/sessionstore/SessionFile.sys.mjs"
);

const MAX_ENTRIES = 9;
const URL = "http://example.com/#";

async function prepareWithLimit(back, fwd) {
  SessionWriter.init("empty", false, Paths, {
    maxSerializeBack: back,
    maxSerializeForward: fwd,
    maxUpgradeBackups: 3,
  });
  await SessionWriter.wipe();
}

add_setup(async function () {
  registerCleanupFunction(() => SessionWriter.wipe());
});

function createSessionState(index) {
  // Generate the tab state entries and set the one-based
  // tab-state index to the middle session history entry.
  let tabState = { entries: [], index };
  for (let i = 0; i < MAX_ENTRIES; i++) {
    tabState.entries.push({ url: URL + i });
  }

  return { windows: [{ tabs: [tabState] }] };
}

async function writeAndParse(state, path, options = {}) {
  // We clone here because `write` can change the data passed.
  let data = structuredClone(state);
  await SessionWriter.write(data, options);
  return IOUtils.readJSON(path, { decompress: true });
}

add_task(async function test_shistory_cap_none() {
  let state = createSessionState(5);

  // Don't limit the number of shistory entries.
  await prepareWithLimit(-1, -1);

  // Check that no caps are applied.
  let diskState = await writeAndParse(state, Paths.clean, {
    isFinalWrite: true,
  });
  Assert.deepEqual(state, diskState, "no cap applied");
});

add_task(async function test_shistory_cap_middle() {
  let state = createSessionState(5);
  await prepareWithLimit(2, 3);

  // Cap is only applied on clean shutdown.
  let diskState = await writeAndParse(state, Paths.recovery);
  Assert.deepEqual(state, diskState, "no cap applied");

  // Check that the right number of shistory entries was discarded
  // and the shistory index updated accordingly.
  diskState = await writeAndParse(state, Paths.clean, { isFinalWrite: true });
  let tabState = state.windows[0].tabs[0];
  tabState.entries = tabState.entries.slice(2, 8);
  tabState.index = 3;
  Assert.deepEqual(state, diskState, "cap applied");
});

add_task(async function test_shistory_cap_lower_bound() {
  let state = createSessionState(1);
  await prepareWithLimit(5, 5);

  // Cap is only applied on clean shutdown.
  let diskState = await writeAndParse(state, Paths.recovery);
  Assert.deepEqual(state, diskState, "no cap applied");

  // Check that the right number of shistory entries was discarded.
  diskState = await writeAndParse(state, Paths.clean, { isFinalWrite: true });
  let tabState = state.windows[0].tabs[0];
  tabState.entries = tabState.entries.slice(0, 6);
  Assert.deepEqual(state, diskState, "cap applied");
});

add_task(async function test_shistory_cap_upper_bound() {
  let state = createSessionState(MAX_ENTRIES);
  await prepareWithLimit(5, 5);

  // Cap is only applied on clean shutdown.
  let diskState = await writeAndParse(state, Paths.recovery);
  Assert.deepEqual(state, diskState, "no cap applied");

  // Check that the right number of shistory entries was discarded
  // and the shistory index updated accordingly.
  diskState = await writeAndParse(state, Paths.clean, { isFinalWrite: true });
  let tabState = state.windows[0].tabs[0];
  tabState.entries = tabState.entries.slice(3);
  tabState.index = 6;
  Assert.deepEqual(state, diskState, "cap applied");
});
