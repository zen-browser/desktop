/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_task(async function test_SimpleTabOpen() {
  await withNewTabAndWindow(async (newTab, win) => {
    let tabId = newTab.id;
    let otherTab = gZenWindowSync.getItemFromWindow(win, tabId);
    Assert.ok(otherTab, "The opened tab should be found in the synced window");
    Assert.ok(newTab._zenContentsVisible, "The opened tab should be visible");
    Assert.equal(otherTab.id, tabId, "The opened tab ID should match the synced tab ID");
  });
});
