/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

'use strict';

function getToolbarNodeForItemGuid(aItemGuid) {
  var children = document.getElementById('PlacesToolbarItems').children;
  for (let child of children) {
    if (aItemGuid == child._placesNode.bookmarkGuid) {
      return child;
    }
  }
  return null;
}

function isToolbarVisible(aToolbar) {
  let hidingAttribute = aToolbar.getAttribute('type') == 'menubar' ? 'autohide' : 'collapsed';
  let hidingValue = aToolbar.getAttribute(hidingAttribute)?.toLowerCase();
  // Check for both collapsed="true" and collapsed="collapsed"
  return hidingValue !== 'true' && hidingValue !== hidingAttribute;
}

function promiseSetToolbarVisibility(aToolbar, aVisible) {
  if (isToolbarVisible(aToolbar) != aVisible) {
    let visibilityChanged = TestUtils.waitForCondition(() => aToolbar.collapsed != aVisible);
    setToolbarVisibility(aToolbar, aVisible, undefined, false);
    return visibilityChanged;
  }
  return Promise.resolve();
}

async function changeWorkspaceForBookmark(aBookmark, aWorkspace) {
  const toolbarNode = getToolbarNodeForItemGuid(aBookmark.guid);
  await withBookmarksDialog(
    false,
    async function openPropertiesDialog() {
      let placesContext = document.getElementById('placesContext');
      let promisePopup = BrowserTestUtils.waitForEvent(placesContext, 'popupshown');
      EventUtils.synthesizeMouseAtCenter(toolbarNode, {
        button: 2,
        type: 'contextmenu',
      });
      await promisePopup;

      let properties = document.getElementById('placesContext_show_bookmark:info');
      placesContext.activateItem(properties, {});
    },
    async function test(dialogWin) {
      // Ensure the dialog has initialized.
      await TestUtils.waitForCondition(() => dialogWin.document.title);

      let openWorkspaceSelectorButton = dialogWin.document.getElementById(
        'editBMPanel_workspacesSelectorExpander'
      );

      // Open the workspace selector.
      openWorkspaceSelectorButton.click();

      await setTimeout(() => {}, 100);
      const checkbox = dialogWin.document.querySelector(`input[value="${aWorkspace.uuid}"]`);

      // Check the checkbox for the workspace.
      checkbox.click();
      await setTimeout(() => {}, 100);

      // Confirm and close the dialog.
      EventUtils.synthesizeKey('VK_RETURN', {}, dialogWin);
      await setTimeout(() => {}, 100);
    }
  );
}

async function withBookmarksShowing(aCallback) {
  await SpecialPowers.pushPrefEnv({
    set: [['zen.view.hide-window-controls', false]],
  });
  await setTimeout(() => {}, 1000);
  await aCallback();
  await SpecialPowers.popPrefEnv();
}

add_setup(async function () {
  let toolbar = document.getElementById('PersonalToolbar');
  let wasCollapsed = toolbar.collapsed;

  // Uncollapse the personal toolbar if needed.
  if (wasCollapsed) {
    await promiseSetToolbarVisibility(toolbar, true);
  }

  registerCleanupFunction(async () => {
    // Collapse the personal toolbar if needed.
    if (wasCollapsed) {
      await promiseSetToolbarVisibility(toolbar, false);
    }
    await PlacesUtils.bookmarks.eraseEverything();
  });
});

add_task(async function test_workspace_bookmark() {
  todo(false, 'Properly implement this function');
  return;

  await withBookmarksShowing(async () => {
    await gZenWorkspaces.createAndSaveWorkspace('Test Workspace 2');
    const workspaces = await gZenWorkspaces._workspaces();
    ok(workspaces.workspaces.length === 2, 'Two workspaces should exist.');
    const firstWorkspace = workspaces.workspaces[0];
    const secondWorkspace = workspaces.workspaces[1];
    ok(
      firstWorkspace.uuid !== secondWorkspace.uuid,
      'The new workspace should be different from the current one.'
    );

    const bookmark1 = await PlacesUtils.bookmarks.insert({
      parentGuid: PlacesUtils.bookmarks.toolbarGuid,
      title: 'workspace1',
      url: Services.io.newURI('https://example.com/'),
      workspaces: [firstWorkspace.uuid],
    });

    await changeWorkspaceForBookmark(bookmark1, firstWorkspace);

    const bookmark2 = await PlacesUtils.bookmarks.insert({
      parentGuid: PlacesUtils.bookmarks.toolbarGuid,
      title: 'workspace2',
      url: Services.io.newURI('https://example.com/'),
      workspaces: [secondWorkspace.uuid],
    });

    await changeWorkspaceForBookmark(bookmark2, secondWorkspace);

    await gZenWorkspaces.changeWorkspace(secondWorkspace);
    const toolbarNode1 = getToolbarNodeForItemGuid(bookmark1.guid);
    const toolbarNode2 = getToolbarNodeForItemGuid(bookmark2.guid);
    ok(toolbarNode1, 'Bookmark1 should be in the toolbar');
    ok(!toolbarNode2, 'Bookmark2 should be in the toolbar');

    await gZenWorkspaces.changeWorkspace(firstWorkspace);

    const toolbarNode3 = getToolbarNodeForItemGuid(bookmark1.guid);
    const toolbarNode4 = getToolbarNodeForItemGuid(bookmark2.guid);
    ok(!toolbarNode3, 'Bookmark1 should be in the toolbar');
    ok(toolbarNode4, 'Bookmark2 should be in the toolbar');

    await PlacesUtils.bookmarks.remove(bookmark1);
    await PlacesUtils.bookmarks.remove(bookmark2);

    await gZenWorkspaces.removeWorkspace(secondWorkspace.uuid);
  });
});
