/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

async function setTabTitle(tab, title) {
  const titleChanged = BrowserTestUtils.waitForEvent(
    tab,
    "TabAttrModified",
    false,
    event => event.detail.changed.includes("label") && tab.label === title
  );
  await SpecialPowers.spawn(tab.linkedBrowser, [title], newTitle => {
    content.document.title = newTitle;
  });
  await titleChanged;
}

function hasUnreadDot(tab) {
  return getComputedStyle(
    tab.querySelector(".tab-content")
  ).backgroundImage.includes("radial-gradient");
}

add_task(async function test_unread_dot_from_essential_title() {
  const tab = await addTab("data:text/html,<title>Inbox</title>");

  await setTabTitle(tab, "(3) Inbox");
  ok(!hasUnreadDot(tab), "A regular tab with an unread count has no dot");

  gBrowser.pinTab(tab);
  gZenPinnedTabManager.addToEssentials(tab);

  ok(hasUnreadDot(tab), "An Essential with an unread count shows the dot");

  await setTabTitle(tab, "Inbox");
  ok(!hasUnreadDot(tab), "Removing the unread count removes the dot");

  await setTabTitle(tab, "(99+) Inbox");
  ok(hasUnreadDot(tab), "A capped unread count also shows the dot");

  await setTabTitle(tab, "(3 unread) Inbox");
  ok(!hasUnreadDot(tab), "A malformed unread count does not show the dot");

  await setTabTitle(tab, "(1,,2) Inbox");
  ok(!hasUnreadDot(tab), "Malformed separators do not show the dot");

  await setTabTitle(tab, "(1,234.567) Inbox");
  ok(!hasUnreadDot(tab), "Mixed separators do not show the dot");

  await BrowserTestUtils.removeTab(tab);
});
