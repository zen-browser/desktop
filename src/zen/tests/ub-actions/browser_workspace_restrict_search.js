/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

ChromeUtils.defineESModuleGetters(this, {
  UrlbarTestUtils: "resource://testing-common/UrlbarTestUtils.sys.mjs",
  UrlbarUtils: "moz-src:///browser/components/urlbar/UrlbarUtils.sys.mjs",
});

UrlbarTestUtils.init(this);

add_task(async function test_Workspace_Search_OneOff_Pref() {
  const oneOffSearchButtons = UrlbarTestUtils.getOneOffSearchButtons(window);

  async function openPopupAndWaitForRebuild(value = "") {
    oneOffSearchButtons.invalidateCache();
    const rebuildPromise = BrowserTestUtils.waitForEvent(
      oneOffSearchButtons,
      "rebuild"
    );
    await UrlbarTestUtils.promiseAutocompleteResultPopup({
      window,
      waitForFocus,
      value,
    });
    await rebuildPromise;
  }

  function getWorkspaceShortcut() {
    return [...oneOffSearchButtons.localButtons].find(
      button => button.source == UrlbarUtils.RESULT_SOURCE.WORKSPACES
    );
  }

  try {
    await SpecialPowers.pushPrefEnv({
      set: [["zen.urlbar.hide-one-offs", false]],
    });

    await openPopupAndWaitForRebuild();
    ok(
      getWorkspaceShortcut(),
      "The workspace shortcut should be visible when the pref is enabled"
    );
    await UrlbarTestUtils.promisePopupClose(window);

    await SpecialPowers.pushPrefEnv({
      set: [["browser.urlbar.shortcuts.workspaces", false]],
    });

    try {
      await openPopupAndWaitForRebuild();
      ok(
        !getWorkspaceShortcut(),
        "The workspace shortcut should be hidden when the pref is disabled"
      );
      await UrlbarTestUtils.promisePopupClose(window);
    } finally {
      await SpecialPowers.popPrefEnv();
    }
  } finally {
    await SpecialPowers.popPrefEnv();
    if (UrlbarTestUtils.isPopupOpen(window)) {
      await UrlbarTestUtils.promisePopupClose(window);
    }
  }
});

add_task(async function test_Workspace_Restrict_Search() {
  const originalWorkspaceId = gZenWorkspaces.activeWorkspace;
  const workspaceName = "zen-urlbar-workspace-proof-617db8";

  await gZenWorkspaces.createAndSaveWorkspace(workspaceName);

  const createdWorkspace = gZenWorkspaces
    .getWorkspaces()
    .find(workspace => workspace.name == workspaceName);
  ok(createdWorkspace, "Created the workspace used by the urlbar test");

  registerCleanupFunction(async function () {
    if (UrlbarTestUtils.isPopupOpen(window)) {
      await UrlbarTestUtils.promisePopupClose(window, () =>
        EventUtils.synthesizeKey("KEY_Escape")
      );
    }
    if (gZenWorkspaces.activeWorkspace != originalWorkspaceId) {
      await gZenWorkspaces.changeWorkspace(originalWorkspaceId);
    }
    if (
      gZenWorkspaces
        .getWorkspaces()
        .some(workspace => workspace.uuid == createdWorkspace.uuid)
    ) {
      await gZenWorkspaces.removeWorkspace(createdWorkspace.uuid);
    }
  });

  await gZenWorkspaces.changeWorkspace(originalWorkspaceId);

  await UrlbarTestUtils.promiseAutocompleteResultPopup({
    window,
    waitForFocus,
    value: "` " + workspaceName,
  });
  // Wait for the second search started when the typed token enters search mode.
  await UrlbarTestUtils.promiseSearchComplete(window);
  ok(gURLBar.searchMode, "The urlbar should enter search mode");
  Assert.equal(
    gURLBar.searchMode.source,
    UrlbarUtils.RESULT_SOURCE.WORKSPACES,
    "The typed token should enter workspace search mode"
  );
  Assert.equal(
    gURLBar.searchMode.entry,
    "typed",
    "The workspace search mode should be entered by typing the token"
  );
  Assert.equal(gURLBar.value, workspaceName, "The token should be stripped");

  const resultCount = UrlbarTestUtils.getResultCount(window);
  ok(resultCount > 0, "Should show at least one workspace result");

  const resultDetails = [];
  for (let i = 0; i < resultCount; i++) {
    resultDetails.push(await UrlbarTestUtils.getDetailsOfResultAt(window, i));
  }

  ok(
    resultDetails.every(
      ({ result, source }) =>
        source == UrlbarUtils.RESULT_SOURCE.WORKSPACES &&
        result.providerName == "ZenUrlbarProviderGlobalActions"
    ),
    "Typing the workspace token should limit results to workspace actions"
  );
  Assert.equal(
    resultDetails[0].result.payload.prettyName,
    workspaceName,
    "The matching workspace should be shown first"
  );
});
