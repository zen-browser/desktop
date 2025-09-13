/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

'use strict';

add_task(async function test_Glance_Keyboard_Shortcut_F() {
  await openGlanceOnTab(async (glanceTab) => {
    // Test the 'F' key shortcut for expanding glance
    const expandCommand = document.getElementById('cmd_zenGlanceExpand');
    ok(expandCommand, 'Expand command should exist');
    
    // Simulate the keyboard shortcut by calling the command
    expandCommand.doCommand();
    
    // Wait for the glance to be expanded
    await BrowserTestUtils.waitForCondition(() => {
      return !glanceTab.hasAttribute('zen-glance-tab');
    }, 'Glance should be expanded (zen-glance-tab attribute removed)');
    
    ok(
      !glanceTab.hasAttribute('zen-glance-tab'),
      'The glance tab should not have the zen-glance-tab attribute after expanding'
    );
    
    BrowserTestUtils.removeTab(glanceTab);
  }, false);
});

add_task(async function test_Glance_Keyboard_Shortcut_S() {
  await openGlanceOnTab(async (glanceTab) => {
    // Test the 'S' key shortcut for splitting glance
    const splitCommand = document.getElementById('cmd_zenGlanceSplit');
    ok(splitCommand, 'Split command should exist');
    
    // Simulate the keyboard shortcut by calling the command
    splitCommand.doCommand();
    
    // Wait for the glance to be split
    await BrowserTestUtils.waitForCondition(() => {
      return !glanceTab.hasAttribute('zen-glance-tab');
    }, 'Glance should be split (zen-glance-tab attribute removed)');
    
    ok(
      !glanceTab.hasAttribute('zen-glance-tab'),
      'The glance tab should not have the zen-glance-tab attribute after splitting'
    );
    
    BrowserTestUtils.removeTab(glanceTab);
  }, false);
});
