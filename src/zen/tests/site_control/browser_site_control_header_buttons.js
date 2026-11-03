/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

function shareButton() {
  return document.getElementById("zen-site-data-header-share");
}

function bookmarkButton() {
  return document.getElementById("zen-site-data-header-bookmark");
}

function boostButton() {
  return document.getElementById("zen-site-data-header-boost");
}

add_task(async function test_share_button_reflects_scheme() {
  const tab = BrowserTestUtils.addTab(gBrowser, HTTPS_PAGE, {
    skipAnimation: true,
  });
  await BrowserTestUtils.browserLoaded(tab.linkedBrowser);
  await BrowserTestUtils.switchTab(gBrowser, tab);

  try {
    await openSiteDataPanel();
    ok(
      !shareButton().hasAttribute("disabled"),
      "share button is enabled on https pages"
    );
    await closeSiteDataPanel();

    await loadUrl("about:blank");

    await openSiteDataPanel();
    ok(
      shareButton().hasAttribute("disabled"),
      "share button is disabled on about:blank"
    );
    await closeSiteDataPanel();
  } finally {
    await closeSiteDataPanel();
    BrowserTestUtils.removeTab(tab);
  }
});

add_task(async function test_bookmark_button_reflects_starred_state() {
  const tab = BrowserTestUtils.addTab(gBrowser, HTTPS_PAGE, {
    skipAnimation: true,
  });
  await BrowserTestUtils.browserLoaded(tab.linkedBrowser);
  await BrowserTestUtils.switchTab(gBrowser, tab);

  let bookmark;
  try {
    await openSiteDataPanel();
    ok(
      !bookmarkButton().classList.contains("active"),
      "bookmark button is not active on an un-bookmarked page"
    );
    await closeSiteDataPanel();

    bookmark = await PlacesUtils.bookmarks.insert({
      parentGuid: PlacesUtils.bookmarks.unfiledGuid,
      url: HTTPS_PAGE,
      title: "test-bookmark",
    });
    await TestUtils.waitForCondition(
      () => BookmarkingUI.star?.hasAttribute("starred"),
      "BookmarkingUI picks up the new bookmark"
    );

    await openSiteDataPanel();
    ok(
      bookmarkButton().classList.contains("active"),
      "bookmark button becomes active once the page is bookmarked"
    );
    await closeSiteDataPanel();
  } finally {
    if (bookmark) {
      await PlacesUtils.bookmarks.remove(bookmark);
    }
    await closeSiteDataPanel();
    BrowserTestUtils.removeTab(tab);
  }
});

add_task(async function test_boost_button_reflects_boostable_site() {
  const tab = BrowserTestUtils.addTab(gBrowser, HTTPS_PAGE, {
    skipAnimation: true,
  });
  await BrowserTestUtils.browserLoaded(tab.linkedBrowser);
  await BrowserTestUtils.switchTab(gBrowser, tab);

  try {
    await openSiteDataPanel();
    ok(
      !boostButton().hasAttribute("disabled"),
      "create boost header button is enabled on boostable https pages"
    );
  } finally {
    await closeSiteDataPanel();
    BrowserTestUtils.removeTab(tab);
  }
});
