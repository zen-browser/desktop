/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

'use strict';

add_task(async function test_Container_Essentials_Auto_Swithc() {
  await gZenWorkspaces.createAndSaveWorkspace('Container Profile 1', undefined, false, 1);
  const workspaces = await gZenWorkspaces._workspaces();
  ok(workspaces.workspaces.length === 2, 'Two workspaces should exist.');

  let newTab = BrowserTestUtils.addTab(gBrowser, 'about:blank', {
    skipAnimation: true,
    userContextId: 1,
  });
  ok(newTab, 'New tab should be opened.');
  gZenPinnedTabManager.addToEssentials(newTab);
  ok(
    newTab.hasAttribute('zen-essential') && newTab.parentNode.getAttribute('container') == '1',
    'New tab should be marked as essential.'
  );
  ok(
    gBrowser.tabs.find(
      (t) => t.hasAttribute('zen-essential') && t.getAttribute('usercontextid') == 1
    ),
    'New tab should be marked as essential.'
  );
  const newWorkspaceUUID = gZenWorkspaces.activeWorkspace;
  Assert.equal(
    gZenWorkspaces.activeWorkspace,
    workspaces.workspaces[1].uuid,
    'The new workspace should be active.'
  );

  // Change to the original workspace, there should be no essential tabs
  await gZenWorkspaces.changeWorkspace(workspaces.workspaces[0]);
  await gZenWorkspaces.removeWorkspace(newWorkspaceUUID);
});
