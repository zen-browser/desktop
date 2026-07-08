/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

async function pinTab(url) {
  const tab = await BrowserTestUtils.openNewForegroundTab(gBrowser, url);
  gBrowser.pinTab(tab);
  await gBrowser.TabStateFlusher.flush(tab.linkedBrowser);
  // eslint-disable-next-line mozilla/no-arbitrary-setTimeout
  await new Promise(r => setTimeout(r, 500));
  return tab;
}

// XPCOM service methods can't be stubbed in place (non-configurable), so we
// swap the whole service object out for a mock and restore it afterwards.
function mockPrompt(value) {
  const original = Services.prompt;
  Services.prompt = {
    QueryInterface: ChromeUtils.generateQI([Ci.nsIPromptService]),
    prompt(win, title, label, result) {
      if (value === null) {
        return false; // user cancelled
      }
      result.value = value;
      return true;
    },
  };
  return () => {
    Services.prompt = original;
  };
}

function mockFavicons(faviconSpec) {
  const original = PlacesUtils.favicons;
  const mock = {
    callCount: 0,
    defaultFavicon: { spec: "data:image/png;base64,DEFAULT" },
    getFaviconForPage() {
      mock.callCount++;
      return Promise.resolve(
        faviconSpec ? { dataURI: { spec: faviconSpec } } : null
      );
    },
  };
  PlacesUtils.favicons = mock;
  return {
    mock,
    restore: () => {
      PlacesUtils.favicons = original;
    },
  };
}

add_task(async function test_EditPinnedUrl_SurvivesRebuild() {
  // Pinned tab at url1 (loaded), then select a different tab (unfocus it).
  const tab = await pinTab("https://example.com/1");
  const other = await BrowserTestUtils.openNewForegroundTab(
    gBrowser,
    "https://example.com/other"
  );

  const editedUrl = "https://example.com/edited";
  const restorePrompt = mockPrompt(editedUrl);
  const favicons = mockFavicons("data:image/png;base64,iVBORw0KGgo=");
  try {
    await gZenPinnedTabManager.editPinnedUrl(tab);

    // Close + re-open rebuilds the tab: the in-memory _zenPinnedInitialState is
    // gone and gets reconstructed from the persisted session via
    // setPinnedTabState (exactly what #onSessionStoreInitialized does).
    delete tab._zenPinnedInitialState;
    await window.gZenWindowSync.setPinnedTabState(tab);

    Assert.equal(
      tab._zenPinnedInitialState.entry.url,
      editedUrl,
      "After the tab is rebuilt, the pinned URL should still be the edited one"
    );
  } finally {
    restorePrompt();
    favicons.restore();
    await BrowserTestUtils.removeTab(other);
    await BrowserTestUtils.removeTab(tab);
  }
});

add_task(async function test_EditPinnedUrl_ActiveTabNavigates() {
  // Editing the active (focused) pinned tab applies the new URL immediately:
  // the live tab navigates to it (matching Arc's behavior).
  const tab = await pinTab("https://example.com/1");
  Assert.equal(gBrowser.selectedTab, tab, "the pinned tab should be active");

  const editedUrl = "https://example.com/edited";
  const restorePrompt = mockPrompt(editedUrl);
  const favicons = mockFavicons("data:image/png;base64,iVBORw0KGgo=");
  try {
    await gZenPinnedTabManager.editPinnedUrl(tab);
    await BrowserTestUtils.waitForCondition(
      () => tab.linkedBrowser.currentURI.spec === editedUrl,
      "the active pinned tab to navigate to the edited URL"
    );

    Assert.equal(
      tab.linkedBrowser.currentURI.spec,
      editedUrl,
      "Editing the active pinned tab should navigate it to the new URL"
    );
  } finally {
    restorePrompt();
    favicons.restore();
    await BrowserTestUtils.removeTab(tab);
  }
});

add_task(
  async function test_EditPinnedUrl_FaviconLookupErrorLeavesImageEmpty() {
    const tab = await pinTab("https://example.com/1");
    const restorePrompt = mockPrompt("https://example.org/edited");
    const favicons = mockFavicons(null);
    // Simulate a Places DB failure so #getCachedFavicon hits its catch branch.
    favicons.mock.getFaviconForPage = () =>
      Promise.reject(new Error("simulated favicon DB failure"));

    try {
      await gZenPinnedTabManager.editPinnedUrl(tab);

      Assert.equal(
        tab._zenPinnedInitialState.entry.url,
        "https://example.org/edited",
        "The URL should still be updated when the favicon lookup fails"
      );
      ok(
        !tab._zenPinnedInitialState.image,
        "The image should be left empty (populated by the next navigation)"
      );
    } finally {
      restorePrompt();
      favicons.restore();
      await BrowserTestUtils.removeTab(tab);
    }
  }
);

add_task(async function test_EditPinnedUrl_UpdatesUrlAndFavicon() {
  const tab = await pinTab("https://example.com/1");
  const faviconSpec = "data:image/png;base64,iVBORw0KGgo=";
  const restorePrompt = mockPrompt("https://example.org/edited");
  const favicons = mockFavicons(faviconSpec);

  try {
    await gZenPinnedTabManager.editPinnedUrl(tab);

    Assert.equal(
      tab._zenPinnedInitialState.entry.url,
      "https://example.org/edited",
      "The pinned URL should be updated to the edited value"
    );
    Assert.equal(
      tab._zenPinnedInitialState.image,
      faviconSpec,
      "The stored icon should be the cached favicon for the new URL"
    );
  } finally {
    restorePrompt();
    favicons.restore();
    await BrowserTestUtils.removeTab(tab);
  }
});

add_task(async function test_EditPinnedUrl_NoCachedFaviconLeavesImageEmpty() {
  const tab = await pinTab("https://example.com/1");
  const restorePrompt = mockPrompt("https://example.org/edited");
  const favicons = mockFavicons(null); // no cached favicon for the new URL

  try {
    await gZenPinnedTabManager.editPinnedUrl(tab);

    ok(
      !tab._zenPinnedInitialState.image,
      "Without a cached favicon the image is left empty, not the default; the " +
        "next navigation captures the real icon"
    );
  } finally {
    restorePrompt();
    favicons.restore();
    await BrowserTestUtils.removeTab(tab);
  }
});

add_task(async function test_EditPinnedUrl_ClearsStaleTitle() {
  const tab = await pinTab("https://example.com/1");
  const restorePrompt = mockPrompt("https://example.org/edited");
  const favicons = mockFavicons("data:image/png;base64,iVBORw0KGgo=");

  try {
    await gZenPinnedTabManager.editPinnedUrl(tab);

    ok(
      !tab._zenPinnedInitialState.entry.title,
      "The previous title is cleared so the new page's title is used on load"
    );
  } finally {
    restorePrompt();
    favicons.restore();
    await BrowserTestUtils.removeTab(tab);
  }
});

add_task(async function test_EditPinnedUrl_KeepsCustomLabel() {
  const tab = await pinTab("https://example.com/1");
  tab.zenStaticLabel = "My Pinned Tab";
  const restorePrompt = mockPrompt("https://example.org/edited");
  const favicons = mockFavicons("data:image/png;base64,iVBORw0KGgo=");

  try {
    await gZenPinnedTabManager.editPinnedUrl(tab);

    Assert.equal(
      tab._zenPinnedInitialState.entry.title,
      "My Pinned Tab",
      "An explicit custom label is preserved across a URL edit"
    );
  } finally {
    restorePrompt();
    favicons.restore();
    delete tab.zenStaticLabel;
    await BrowserTestUtils.removeTab(tab);
  }
});

add_task(async function test_EditPinnedUrl_KeepsCustomIcon() {
  const tab = await pinTab("https://example.com/1");
  const customIcon = "data:image/svg+xml,custom-icon";
  tab.zenStaticIcon = customIcon;
  const restorePrompt = mockPrompt("https://example.org/edited");
  const favicons = mockFavicons("data:image/png;base64,iVBORw0KGgo=");

  try {
    await gZenPinnedTabManager.editPinnedUrl(tab);

    Assert.equal(
      tab._zenPinnedInitialState.entry.url,
      "https://example.org/edited",
      "The pinned URL should still be updated when a custom icon is set"
    );
    Assert.equal(
      tab._zenPinnedInitialState.image,
      customIcon,
      "A user-set custom icon should be preserved, not overridden by a favicon"
    );
    Assert.equal(
      favicons.mock.callCount,
      0,
      "Favicon lookup should be skipped when a custom icon is set"
    );
  } finally {
    restorePrompt();
    favicons.restore();
    delete tab.zenStaticIcon;
    await BrowserTestUtils.removeTab(tab);
  }
});

add_task(async function test_EditPinnedUrl_InvalidUrlKeepsState() {
  const tab = await pinTab("https://example.com/1");
  const originalUrl = tab._zenPinnedInitialState.entry.url;
  const restorePrompt = mockPrompt("   "); // whitespace only -> not a valid URL
  const favicons = mockFavicons("data:image/png;base64,iVBORw0KGgo=");

  try {
    await gZenPinnedTabManager.editPinnedUrl(tab);

    Assert.equal(
      tab._zenPinnedInitialState.entry.url,
      originalUrl,
      "The pinned URL should be unchanged for invalid input"
    );
    ok(
      !tab.hasAttribute("zen-pinned-changed"),
      "The tab should not be marked as changed for invalid input"
    );
  } finally {
    restorePrompt();
    favicons.restore();
    await BrowserTestUtils.removeTab(tab);
  }
});

add_task(async function test_EditPinnedUrl_CancelKeepsState() {
  const tab = await pinTab("https://example.com/1");
  const originalUrl = tab._zenPinnedInitialState.entry.url;
  const restorePrompt = mockPrompt(null); // user cancels the dialog

  try {
    await gZenPinnedTabManager.editPinnedUrl(tab);

    Assert.equal(
      tab._zenPinnedInitialState.entry.url,
      originalUrl,
      "The pinned URL should be unchanged when the dialog is cancelled"
    );
  } finally {
    restorePrompt();
    await BrowserTestUtils.removeTab(tab);
  }
});

add_task(async function test_EditPinnedUrl_FixesSchemeTypo() {
  const tab = await pinTab("https://example.com/1");
  const restorePrompt = mockPrompt("htps://example.org/typo");
  const favicons = mockFavicons("data:image/png;base64,iVBORw0KGgo=");

  try {
    await gZenPinnedTabManager.editPinnedUrl(tab);

    Assert.equal(
      tab._zenPinnedInitialState.entry.url,
      "https://example.org/typo",
      "A mistyped scheme (htps://) should be auto-fixed to https://"
    );
  } finally {
    restorePrompt();
    favicons.restore();
    await BrowserTestUtils.removeTab(tab);
  }
});

add_task(async function test_EditPinnedUrl_AddsMissingScheme() {
  const tab = await pinTab("https://example.com/1");
  const restorePrompt = mockPrompt("example.org/no-scheme");
  const favicons = mockFavicons("data:image/png;base64,iVBORw0KGgo=");

  try {
    await gZenPinnedTabManager.editPinnedUrl(tab);

    const stored = tab._zenPinnedInitialState.entry.url;
    ok(
      /^https?:\/\//.test(stored),
      `A scheme should be prepended when omitted (got "${stored}")`
    );
    ok(
      stored.endsWith("example.org/no-scheme"),
      `Host and path should be preserved (got "${stored}")`
    );
  } finally {
    restorePrompt();
    favicons.restore();
    await BrowserTestUtils.removeTab(tab);
  }
});

add_task(async function test_EditPinnedUrl_PrefillsWithStoredUrl() {
  const tab = await pinTab("https://example.com/1");
  // The stored pinned URL differs from the live browser URL (e.g. it was pinned
  // as http but the server redirected the tab to https).
  tab._zenPinnedInitialState = {
    entry: { url: "http://example.com/pinned" },
    image: "",
  };

  let prefilled;
  const originalPrompt = Services.prompt;
  Services.prompt = {
    QueryInterface: ChromeUtils.generateQI([Ci.nsIPromptService]),
    prompt(win, title, label, result) {
      prefilled = result.value;
      return false; // cancel, we only care about the prefilled value
    },
  };

  try {
    await gZenPinnedTabManager.editPinnedUrl(tab);

    Assert.equal(
      prefilled,
      "http://example.com/pinned",
      "The edit dialog should prefill with the stored pinned URL, not the live browser URL"
    );
  } finally {
    Services.prompt = originalPrompt;
    await BrowserTestUtils.removeTab(tab);
  }
});
