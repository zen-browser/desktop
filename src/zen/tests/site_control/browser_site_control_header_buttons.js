/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

function shareButton() {
  return document.getElementById("zen-site-data-header-share");
}

function bookmarkButton() {
  return document.getElementById("zen-site-data-header-bookmark");
}

function readerButton() {
  return document.getElementById("zen-site-data-header-reader-mode");
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
    await BrowserTestUtils.waitForCondition(
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

add_task(async function test_reader_mode_button_disabled_when_unavailable() {
  const tab = BrowserTestUtils.addTab(gBrowser, HTTPS_PAGE, {
    skipAnimation: true,
  });
  await BrowserTestUtils.browserLoaded(tab.linkedBrowser);
  await BrowserTestUtils.switchTab(gBrowser, tab);

  try {
    await openSiteDataPanel();
    const urlbarReader = document.getElementById("reader-mode-button");
    const expectedDisabled =
      urlbarReader?.hidden && !urlbarReader?.hasAttribute("readeractive");
    Assert.equal(
      readerButton().disabled,
      !!expectedDisabled,
      "reader-mode header button mirrors the urlbar reader button availability"
    );
    await closeSiteDataPanel();
  } finally {
    await closeSiteDataPanel();
    BrowserTestUtils.removeTab(tab);
  }
});
