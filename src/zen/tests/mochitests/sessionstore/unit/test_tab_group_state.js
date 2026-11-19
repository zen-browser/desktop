/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const { TabGroupState } = ChromeUtils.importESModule(
  "moz-src:///browser/components/sessionstore/TabGroupState.sys.mjs"
);

add_task(function test_savedInClosedWindow_leaves_its_input_alone() {
  let openGroupState = {
    id: "group1",
    name: "My group",
    color: "blue",
    collapsed: false,
    saveOnWindowClose: true,
  };

  let savedGroupState = TabGroupState.savedInClosedWindow(openGroupState, 42);

  Assert.deepEqual(
    openGroupState,
    {
      id: "group1",
      name: "My group",
      color: "blue",
      collapsed: false,
      saveOnWindowClose: true,
    },
    "callers that keep the open group state in a window see it unchanged"
  );
  Assert.equal(savedGroupState.saved, true, "the copy is a saved group");
  Assert.equal(savedGroupState.windowClosedId, 42, "it points at the window");
  Assert.deepEqual(
    savedGroupState.tabs,
    [],
    "with tabs for the caller to fill"
  );
  Assert.deepEqual(savedGroupState.splitViews, [], "and split views likewise");
});
