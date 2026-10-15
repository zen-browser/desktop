/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_task(async function test_window_metadata_does_not_retain_window_realm() {
  await withNewSyncedWindow(async win => {
    const targets = [
      ["spaces", win.gZenWorkspaces, "getWorkspacesForSessionStore"],
      ["folders", win.gZenFolders, "storeDataForSessionStore"],
      ["splitViewData", win.gZenViewSplitter, "storeDataForSessionStore"],
    ];
    const originals = targets.map(([, manager, method]) => manager[method]);
    const metadata = win.JSON.parse(
      '{"spaces":[{"uuid":"test-space","theme":{"colors":["blue"]}}],"folders":[{"id":"test-folder","tabs":["test-tab"]}],"splitViewData":[{"tabs":["left","right"]}]}'
    );

    try {
      for (const [field, manager, method] of targets) {
        manager[method] = () => metadata[field];
        Assert.equal(
          Cu.getGlobalForObject(metadata[field]),
          win,
          `${field} starts in the browser window's realm`
        );
      }

      SessionStore.getWindowState(win);
      // The public snapshot is already cloned. Check the internal cache.
      const state = SessionStore._windows[win.__SSi];
      const sharedGlobal = Cu.getGlobalForObject(SessionStore);
      for (const [field] of targets) {
        Assert.equal(
          Cu.getGlobalForObject(state[field]),
          sharedGlobal,
          `${field} is stored in the shared module's realm`
        );
        Assert.deepEqual(
          state[field],
          metadata[field],
          `${field} is preserved`
        );
        Assert.notEqual(state[field], metadata[field], `${field} is a copy`);
      }
      Assert.equal(
        Cu.getGlobalForObject(state.spaces[0].theme.colors),
        sharedGlobal,
        "Nested metadata also belongs to the shared realm"
      );
    } finally {
      targets.forEach(([, manager, method], index) => {
        manager[method] = originals[index];
      });
    }
  });
});
