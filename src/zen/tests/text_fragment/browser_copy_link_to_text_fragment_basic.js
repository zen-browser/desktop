/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Test for the "Copy Link to Text Fragment" context menu option
 */

"use strict";

// Sample HTML content for testing text fragment links
const TEST_PAGE = `
  <!DOCTYPE html>
  <html>
    <head>
      <meta charset="utf-8">
      <title>Text Fragment Test Page</title>
    </head>
    <body>
      <h1>Text Fragment Test</h1>
      <p>This is a test paragraph with some sample text for highlighting.</p>
      <p>This is another paragraph with different content to select.</p>
      <p>This paragraph contains special characters like & and ? and !</p>
    </body>
  </html>
`;

// Create a URL for our test content
function createTestPage() {
  return "data:text/html;charset=utf-8," + encodeURIComponent(TEST_PAGE);
}

// Helper function to get clipboard content
async function getClipboardContent() {
  // Need to use Clipboard API
  return SpecialPowers.getClipboardData("text/unicode");
}

add_task(async function test_copy_link_to_text_fragment_basic() {
  // Open a new tab with our test content
  let tab = await BrowserTestUtils.openNewForegroundTab(gBrowser, createTestPage());
  
  // Select some text in the page
  await SpecialPowers.spawn(tab.linkedBrowser, [], async function() {
    const selection = content.getSelection();
    const range = content.document.createRange();
    const paragraph = content.document.querySelector("p");
    
    // Select the text "sample text" in the first paragraph
    range.setStart(paragraph.firstChild, paragraph.textContent.indexOf("sample text"));
    range.setEnd(paragraph.firstChild, paragraph.textContent.indexOf("sample text") + "sample text".length);
    selection.removeAllRanges();
    selection.addRange(range);
  });
  
  // Wait a moment for the selection to be registered
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Simulate a right-click on the selection
  const contextMenu = document.getElementById("contentAreaContextMenu");
  const awaitPopupShown = BrowserTestUtils.waitForEvent(contextMenu, "popupshown");
  await BrowserTestUtils.synthesizeMouseAtCenter("p", { type: "contextmenu", button: 2 }, tab.linkedBrowser);
  await awaitPopupShown;
  
  // Check that our menu item is visible
  const menuItem = document.getElementById("context-copylinktotextfragment");
  Assert.ok(!menuItem.hidden, "Copy Link to Text Fragment menu item should be visible when text is selected");
  
  // Click on our menu item
  const awaitPopupHidden = BrowserTestUtils.waitForEvent(contextMenu, "popuphidden");
  menuItem.click();
  await awaitPopupHidden;
  
  // Wait a bit to ensure clipboard is updated
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Check the clipboard content
  const clipboardContent = await getClipboardContent();
  Assert.ok(clipboardContent.includes("#:~:text=sample%20text"), 
            "Clipboard should contain a URL with text fragment");
  
  // Close the tab
  BrowserTestUtils.removeTab(tab);
});

add_task(async function test_copy_link_to_text_fragment_not_visible_without_selection() {
  // Open a new tab with our test content
  let tab = await BrowserTestUtils.openNewForegroundTab(gBrowser, createTestPage());
  
  // Make sure no text is selected
  await SpecialPowers.spawn(tab.linkedBrowser, [], async function() {
    content.getSelection().removeAllRanges();
  });
  
  // Right click on the page
  const contextMenu = document.getElementById("contentAreaContextMenu");
  const awaitPopupShown = BrowserTestUtils.waitForEvent(contextMenu, "popupshown");
  await BrowserTestUtils.synthesizeMouseAtCenter("p", { type: "contextmenu", button: 2 }, tab.linkedBrowser);
  await awaitPopupShown;
  
  // Check that our menu item is hidden
  const menuItem = document.getElementById("context-copylinktotextfragment");
  Assert.ok(menuItem.hidden, "Copy Link to Text Fragment menu item should be hidden when no text is selected");
  
  // Close the context menu
  const awaitPopupHidden = BrowserTestUtils.waitForEvent(contextMenu, "popuphidden");
  contextMenu.hidePopup();
  await awaitPopupHidden;
  
  // Close the tab
  BrowserTestUtils.removeTab(tab);
});