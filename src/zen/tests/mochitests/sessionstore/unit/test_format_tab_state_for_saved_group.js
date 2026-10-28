/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_task(function test_tab_without_history_entry_is_skipped() {
  Assert.strictEqual(
    SessionStore.formatTabStateForSavedGroup({ entries: [], index: 1 }),
    null
  );
});

add_task(function test_tab_with_history_entry() {
  let tabState = {
    entries: [
      { url: "https://example.com/", title: "Example" },
      { url: "https://example.org/" },
    ],
    index: 2,
  };

  let tabData = SessionStore.formatTabStateForSavedGroup(tabState);

  Assert.equal(tabData.state, tabState);
  Assert.equal(tabData.title, "https://example.org/");
  Assert.equal(typeof tabData.closedId, "number");
  Assert.equal(typeof tabData.closedAt, "number");
  Assert.ok(!("pos" in tabData));
});
