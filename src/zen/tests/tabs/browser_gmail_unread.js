/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const GMAIL_TEST_PAGE = httpURL("file_gmail_unread.html");

async function setGmailTitle(browser, title) {
  await SpecialPowers.spawn(browser, [title], newTitle => {
    content.document.title = newTitle;
  });
}

add_task(async function test_gmail_unread_dot_on_essential() {
  const tab = await addTab(GMAIL_TEST_PAGE);
  const browser = tab.linkedBrowser;
  gBrowser.pinTab(tab);
  gZenPinnedTabManager.addToEssentials(tab);

  ok(!tab.hasAttribute("zen-gmail-unread"), "Gmail starts without unread mail");

  await setGmailTitle(browser, "(3) Inbox - Gmail");
  await TestUtils.waitForCondition(
    () => tab.hasAttribute("zen-gmail-unread"),
    "The Gmail actor marks the tab as unread"
  );

  const tabContent = tab.querySelector(".tab-content");
  ok(
    getComputedStyle(tabContent).backgroundImage.includes("radial-gradient"),
    "An unread Gmail Essential shows the unread dot"
  );

  await setGmailTitle(browser, "Inbox - Gmail");
  await TestUtils.waitForCondition(
    () => !tab.hasAttribute("zen-gmail-unread"),
    "The Gmail actor clears the unread state"
  );
  is(
    getComputedStyle(tabContent).backgroundImage,
    "none",
    "The unread dot is hidden after Inbox is read"
  );

  await setGmailTitle(browser, "(99+) Inbox - Gmail");
  await TestUtils.waitForCondition(
    () => tab.hasAttribute("zen-gmail-unread"),
    "The Gmail actor accepts Gmail's capped unread count"
  );

  const loaded = BrowserTestUtils.browserLoaded(browser, false, "about:blank");
  BrowserTestUtils.startLoadingURIString(browser, "about:blank");
  await loaded;
  await TestUtils.waitForCondition(
    () => !tab.hasAttribute("zen-gmail-unread"),
    "Leaving Gmail clears the unread state"
  );

  await BrowserTestUtils.removeTab(tab);
});
