"use strict";

const PATH = getRootDirectory(gTestPath).replace(
  "chrome://mochitests/content/",
  "https://example.com/"
);
const EMPTY_URL = PATH + "empty.html";
const EMPTY_FRAME_URL = PATH + "empty_frame.html";

add_setup(async () => {
  await SpecialPowers.pushPrefEnv({
    set: [["dom.navigation.webidl.enabled", true]],
  });
});

async function checkNavigationEntries(browser, urls, inFrame = null) {
  let entryUrls = await SpecialPowers.spawn(browser, [inFrame], aInFrame =>
    (aInFrame ? content.frames[0].navigation : content.navigation)
      .entries()
      .map(entry => entry.url)
  );
  for (const [entryUrl, expectedUrl] of urls.map((expected, i) => [
    entryUrls[i],
    expected,
  ])) {
    is(entryUrl, expectedUrl);
  }
}

add_task(async function test_toplevel_fragment_navigations() {
  let tab = BrowserTestUtils.addTab(gBrowser, EMPTY_URL);
  let browser = tab.linkedBrowser;
  await promiseBrowserLoaded(browser);

  let hashes = ["#1", "#2", "#3"];
  for (const hash of hashes) {
    await SpecialPowers.spawn(browser, [hash], async url => {
      content.history.pushState(null, "", url);
    });
  }
  await SpecialPowers.spawn(browser, [], async () => {
    content.history.back();
  });

  let expectedUrls = ["", ...hashes].map(hash => `${EMPTY_URL}${hash}`);
  await checkNavigationEntries(browser, expectedUrls);

  await TabStateFlusher.flush(browser);
  let { entries } = JSON.parse(ss.getTabState(tab));
  is(entries.length, 4);

  await SessionStoreTestUtils.closeTab(tab);
  tab = ss.undoCloseTab(window, 0);
  await promiseTabRestored(tab);
  browser = tab.linkedBrowser;

  await checkNavigationEntries(browser, expectedUrls);

  gBrowser.removeTab(tab);
});

add_task(async function test_frame_fragment_navigations() {
  let tab = BrowserTestUtils.addTab(gBrowser, EMPTY_FRAME_URL);
  let browser = tab.linkedBrowser;
  await promiseBrowserLoaded(browser);

  let hashes = ["#1", "#2", "#3"];
  for (const hash of hashes) {
    await SpecialPowers.spawn(browser, [hash], async url => {
      content.frames[0].history.pushState(null, "", url);
    });
  }
  await SpecialPowers.spawn(browser, [], async () => {
    content.history.back();
  });

  let expectedUrls = ["", ...hashes].map(hash => `${EMPTY_URL}${hash}`);
  await checkNavigationEntries(browser, expectedUrls, true);

  await TabStateFlusher.flush(browser);
  let { entries } = JSON.parse(ss.getTabState(tab));
  is(entries.length, 4);

  await SessionStoreTestUtils.closeTab(tab);
  tab = ss.undoCloseTab(window, 0);
  await promiseTabRestored(tab);
  browser = tab.linkedBrowser;

  await checkNavigationEntries(browser, expectedUrls, true);

  gBrowser.removeTab(tab);
});

add_task(async function test_mixed_fragment_navigations() {
  let tab = BrowserTestUtils.addTab(gBrowser, EMPTY_FRAME_URL);
  let browser = tab.linkedBrowser;
  await promiseBrowserLoaded(browser);

  let hashes = ["#frame1", "#frame2", "#frame3"];

  await SpecialPowers.spawn(browser, [], async () => {
    content.frames[0].history.pushState(null, "", "#frame1");
    content.frames[0].history.pushState(null, "", "#frame2");
    content.history.pushState(null, "", "#top");
    content.frames[0].history.pushState(null, "", "#frame3");
  });

  let expectedTopUrls = ["", "#top"].map(hash => `${EMPTY_FRAME_URL}${hash}`);
  await checkNavigationEntries(browser, expectedTopUrls);
  let expectedFrameUrls = ["", ...hashes].map(hash => `${EMPTY_URL}${hash}`);
  await checkNavigationEntries(browser, expectedFrameUrls, true);

  await TabStateFlusher.flush(browser);
  let { entries } = JSON.parse(ss.getTabState(tab));
  is(entries.length, 5, "Got expected number of history entries");

  await SessionStoreTestUtils.closeTab(tab);
  tab = ss.undoCloseTab(window, 0);
  await promiseTabRestored(tab);
  browser = tab.linkedBrowser;

  await checkNavigationEntries(browser, expectedTopUrls);
  await checkNavigationEntries(browser, expectedFrameUrls, true);

  gBrowser.removeTab(tab);
});

add_task(async function test_toplevel_navigations() {
  let tab = BrowserTestUtils.addTab(gBrowser, EMPTY_URL);
  let browser = tab.linkedBrowser;
  await promiseBrowserLoaded(browser);

  let urls = ["entry1.html", "entry2.html", "entry3.html"].map(
    url => `${PATH}${url}`
  );
  for (const url of urls) {
    BrowserTestUtils.startLoadingURIString(browser, url);
    await BrowserTestUtils.browserLoaded(browser);
  }

  let expectedUrls = [EMPTY_URL, ...urls];
  await checkNavigationEntries(browser, expectedUrls);

  await TabStateFlusher.flush(browser);
  let { entries } = JSON.parse(ss.getTabState(tab));
  is(entries.length, 4);

  await SessionStoreTestUtils.closeTab(tab);
  tab = ss.undoCloseTab(window, 0);
  await promiseTabRestored(tab);
  browser = tab.linkedBrowser;

  await checkNavigationEntries(browser, expectedUrls);

  gBrowser.removeTab(tab);
});
