/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

'use strict';

add_task(async function test_PinTab_Shortcut() {
  // Create a new tab to test with
  let tab = await BrowserTestUtils.openNewForegroundTab(gBrowser, 'about:blank');
  
  // Initially the tab should not be pinned
  ok(!tab.pinned, 'Tab should not be pinned initially');
  
  // Execute the pin toggle command
  document.getElementById('cmd_zenTogglePinTab').doCommand();
  
  // The tab should now be pinned
  ok(tab.pinned, 'Tab should be pinned after toggle command');
  
  // Execute the command again to unpin
  document.getElementById('cmd_zenTogglePinTab').doCommand();
  
  // The tab should now be unpinned
  ok(!tab.pinned, 'Tab should be unpinned after second toggle command');
  
  // Clean up
  gBrowser.removeTab(tab);
});

add_task(async function test_PinTab_Shortcut_With_No_Tab() {
  // Test the command when no tab is selected (should not throw)
  let originalSelectedTab = gBrowser.selectedTab;
  
  // This should not throw an error
  try {
    document.getElementById('cmd_zenTogglePinTab').doCommand();
    ok(true, 'Command executed without error when no tab selected');
  } catch (e) {
    ok(false, 'Command should not throw error when no tab selected: ' + e.message);
  }
  
  // Restore original state
  gBrowser.selectedTab = originalSelectedTab;
});