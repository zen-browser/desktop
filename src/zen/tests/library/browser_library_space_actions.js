/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

ChromeUtils.defineESModuleGetters(this, {
  sinon: "resource://testing-common/Sinon.sys.mjs",
});

add_task(async function test_library_actions_target_the_card_space() {
  await gZenWorkspaces.promiseInitialized;
  await SpecialPowers.pushPrefEnv({
    set: [["zen.library.last-tab", "history"]],
  });

  const active = gZenWorkspaces.getActiveWorkspace();
  const workspace =
    await gZenWorkspaces.createAndSaveWorkspace("Library actions");
  await gZenWorkspaces.changeWorkspace(active);

  const Library = customElements.get("zen-library");
  const library = document.querySelector("zen-library");
  const menu = document.getElementById("zenWorkspaceMoreActions");
  const share = sinon.stub(gZenShareManager, "shareSpace");
  registerCleanupFunction(async () => {
    share.restore();
    menu.hidePopup();
    if (Library.isLibraryOpen) {
      Library.toggle();
    }
    await TestUtils.waitForCondition(() => !Library.isLibrarySlightlyOpen);
    library.activeTab = "history";
    await library.updateComplete;
    if (gZenWorkspaces.getWorkspaceFromId(workspace.uuid)) {
      await gZenWorkspaces.removeWorkspace(workspace.uuid);
    }
  });

  Library.toggle("spaces");
  await TestUtils.waitForCondition(
    () =>
      Library.libraryProgress === 1 && !library.hasAttribute("transitioning"),
    "The Library settles open"
  );
  const section = library.querySelector("zen-library-spaces-section");
  await section.updateComplete;

  const button = section.querySelector(
    `.zen-library-space-actions[zen-workspace-id="${workspace.uuid}"]`
  );
  button.scrollIntoView({ block: "nearest", inline: "nearest" });
  const shown = BrowserTestUtils.waitForEvent(menu, "popupshown");
  button.querySelector("img").click();
  await shown;

  Assert.equal(
    menu.triggerNode.closest("toolbarbutton"),
    button,
    "The menu retains the card's triggering click"
  );
  gZenWorkspaces.contextShareWorkspace();
  Assert.equal(
    share.firstCall.args[0],
    workspace.uuid,
    "The action uses the Space whose card opened the menu"
  );
  Assert.equal(
    gZenWorkspaces.activeWorkspace,
    active.uuid,
    "Opening the menu does not switch the active Space"
  );

  let awaitingConfirmation = true;
  const confirmDelete = subject => {
    Services.obs.removeObserver(confirmDelete, "common-dialog-loaded");
    awaitingConfirmation = false;
    subject.document.getElementById("commonDialog").acceptDialog();
  };
  Services.obs.addObserver(confirmDelete, "common-dialog-loaded");
  registerCleanupFunction(() => {
    if (awaitingConfirmation) {
      Services.obs.removeObserver(confirmDelete, "common-dialog-loaded");
    }
  });
  menu.activateItem(document.getElementById("context_zenDeleteWorkspace"));
  await TestUtils.waitForCondition(
    () => !gZenWorkspaces.getWorkspaceFromId(workspace.uuid),
    "Delete Space removes the inactive card's Space"
  );
  Assert.ok(
    gZenWorkspaces.getWorkspaceFromId(active.uuid),
    "The active Space survives deleting another card's Space"
  );
  await TestUtils.waitForCondition(() => menu.state === "closed");
  share.resetHistory();
  gZenWorkspaces.contextShareWorkspace();
  Assert.equal(
    share.firstCall.args[0],
    active.uuid,
    "Actions without an open menu use the active Space"
  );
});
