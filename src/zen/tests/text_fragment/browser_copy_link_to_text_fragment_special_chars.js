/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Test for the "Copy Link to Text Fragment" with special characters
 */

"use strict";

// Sample HTML content with special characters
const TEST_PAGE = `
  <!DOCTYPE html>
  <html>
    <head>
      <meta charset="utf-8">
      <title>Text Fragment Special Characters Test</title>
    </head>
    <body>
      <h1>Special Characters Test</h1>
      <p>This text has special characters: & % # ? / @</p>
      <p>This text has unicode characters: 日本語 Français Español</p>
      <p>This text has emojis: 🚀 🔥 🌟</p>
    </body>
  </html>
`;

// Create a URL for our test content
function createTestPage() {
  return "data:text/html;charset=utf-8," + encodeURIComponent(TEST_PAGE);
}

// Helper function to get clipboard content
async function getClipboardContent() {
  return SpecialPowers.getClipboardData("text/unicode");
}

add_task(async function test_copy_link_to_text_fragment_special_chars() {
  // Open a new tab with our test content
  let tab = await BrowserTestUtils.openNewForegroundTab(gBrowser, createTestPage());
  
  // Test cases to select and verify
  const testCases = [
    { text: "special characters: & % # ?", expectedInUrl: "special%20characters%3A%20%26%20%25%20%23%20%3F" },
    { text: "unicode characters: 日本語", expectedInUrl: "unicode%20characters%3A%20%E6%97%A5%E6%9C%AC%E8%AA%9E" },
    { text: "emojis: 🚀 🔥", expectedInUrl: "emojis%3A%20%F0%9F%9A%80%20%F0%9F%94%A5" }
  ];
  
  for (const testCase of testCases) {
    // Select the text for this test case
    await SpecialPowers.spawn(tab.linkedBrowser, [testCase.text], async function(textToSelect) {
      const selection = content.getSelection();
      const range = content.document.createRange();
      
      // Find the paragraph containing our text
      const paragraphs = content.document.querySelectorAll("p");
      let targetParagraph;
      
      for (const p of paragraphs) {
        if (p.textContent.includes(textToSelect)) {
          targetParagraph = p;
          break;
        }
      }
      
      if (targetParagraph) {
        // Select the text
        range.setStart(targetParagraph.firstChild, targetParagraph.textContent.indexOf(textToSelect));
        range.setEnd(targetParagraph.firstChild, targetParagraph.textContent.indexOf(textToSelect) + textToSelect.length);
        selection.removeAllRanges();
        selection.addRange(range);
      }
    });
    
    // Wait a moment for the selection to be registered
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Simulate a right-click on the selection
    const contextMenu = document.getElementById("contentAreaContextMenu");
    const awaitPopupShown = BrowserTestUtils.waitForEvent(contextMenu, "popupshown");
    await BrowserTestUtils.synthesizeMouseAtCenter("p", { type: "contextmenu", button: 2 }, tab.linkedBrowser);
    await awaitPopupShown;
    
    // Click on our menu item
    const menuItem = document.getElementById("context-copylinktotextfragment");
    const awaitPopupHidden = BrowserTestUtils.waitForEvent(contextMenu, "popuphidden");
    menuItem.click();
    await awaitPopupHidden;
    
    // Wait a bit to ensure clipboard is updated
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Check the clipboard content
    const clipboardContent = await getClipboardContent();
    Assert.ok(clipboardContent.includes("#:~:text=" + testCase.expectedInUrl), 
              `Clipboard should contain correctly encoded text fragment for "${testCase.text}"`);
  }
  
  // Close the tab
  BrowserTestUtils.removeTab(tab);
});

add_task(async function test_copy_link_to_text_fragment_truncation() {
  // Open a new tab with our test content
  let tab = await BrowserTestUtils.openNewForegroundTab(gBrowser, createTestPage());
  
  // Create a very long text to select (longer than MAX_FRAGMENT_LENGTH)
  const longText = "This is a very long text that will be truncated. " + "Lorem ipsum ".repeat(30);
  
  // Add the long text to the page
  await SpecialPowers.spawn(tab.linkedBrowser, [longText], async function(text) {
    const p = content.document.createElement("p");
    p.textContent = text;
    p.id = "long-text";
    content.document.body.appendChild(p);
    
    // Select the entire long text
    const selection = content.getSelection();
    const range = content.document.createRange();
    range.selectNodeContents(p);
    selection.removeAllRanges();
    selection.addRange(range);
  });
  
  // Wait a moment for the selection to be registered
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Simulate a right-click on the selection
  const contextMenu = document.getElementById("contentAreaContextMenu");
  const awaitPopupShown = BrowserTestUtils.waitForEvent(contextMenu, "popupshown");
  await BrowserTestUtils.synthesizeMouse("#long-text", 10, 10, { type: "contextmenu", button: 2 }, tab.linkedBrowser);
  await awaitPopupShown;
  
  // Click on our menu item
  const menuItem = document.getElementById("context-copylinktotextfragment");
  const awaitPopupHidden = BrowserTestUtils.waitForEvent(contextMenu, "popuphidden");
  menuItem.click();
  await awaitPopupHidden;
  
  // Wait a bit to ensure clipboard is updated
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Check the clipboard content
  const clipboardContent = await getClipboardContent();
  Assert.ok(clipboardContent.includes("#:~:text="), "Clipboard should contain a text fragment");
  Assert.ok(clipboardContent.length < 500, "URL should be truncated to a reasonable length");
  
  // Close the tab
  BrowserTestUtils.removeTab(tab);
});