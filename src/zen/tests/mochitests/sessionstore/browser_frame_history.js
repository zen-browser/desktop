/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
/* eslint-disable mozilla/no-arbitrary-setTimeout */

/**
 Ensure that frameset history works properly when restoring a tab,
 provided that the frameset is static.
 */

// Loading a toplevel frameset
add_task(async function () {
  await SpecialPowers.pushPrefEnv({
    set: [
      ["browser.navigation.requireUserInteraction", false],
      ["dom.navigation.webidl.enabled", true],
    ],
  });

  let testURL =
    getRootDirectory(gTestPath) + "browser_frame_history_index.html";
  let tab = BrowserTestUtils.addTab(gBrowser, testURL);
  gBrowser.selectedTab = tab;

  info("Opening a page with three frames, 4 loads should take place");
  await waitForLoadsInBrowser(tab.linkedBrowser, 4);

  let browser_b =
    tab.linkedBrowser.contentDocument.getElementsByTagName("frame")[1];
  let document_b = browser_b.contentDocument;
  let links = document_b.getElementsByTagName("a");

  // We're going to click on the first link, so listen for another load event
  info("Clicking on link 1, 1 load should take place");
  let promise = waitForLoadsInBrowser(tab.linkedBrowser, 1);
  EventUtils.sendMouseEvent(
    { type: "click" },
    links[0],
    browser_b.contentWindow
  );
  await promise;

  info("Clicking on link 2, 1 load should take place");
  promise = waitForLoadsInBrowser(tab.linkedBrowser, 1);
  EventUtils.sendMouseEvent(
    { type: "click" },
    links[1],
    browser_b.contentWindow
  );
  await promise;

  info("Close then un-close page, 4 loads should take place");
  await promiseRemoveTabAndSessionState(tab);
  let newTab = ss.undoCloseTab(window, 0);
  await waitForLoadsInBrowser(newTab.linkedBrowser, 4);

  info("Go back in time, 1 load should take place");
  gBrowser.goBack();
  await waitForLoadsInBrowser(newTab.linkedBrowser, 1);

  let expectedURLEnds = ["a.html", "b.html", "c1.html"];
  let frames =
    newTab.linkedBrowser.contentDocument.getElementsByTagName("frame");
  for (let i = 0; i < frames.length; i++) {
    is(
      frames[i].contentDocument.location.href,
      getRootDirectory(gTestPath) +
        "browser_frame_history_" +
        expectedURLEnds[i],
      "frame " + i + " has the right url"
    );
  }

  let expectedUrls = ["c", "c1", "c2"].map(
    url => `${getRootDirectory(gTestPath)}browser_frame_history_${url}.html`
  );
  let entryUrls = frames[2].contentWindow.navigation
    .entries()
    .map(entry => entry.url);
  for (const [entryUrl, expectedUrl] of expectedUrls.map((url, i) => [
    entryUrls[i],
    url,
  ])) {
    is(entryUrl, expectedUrl, "frame 2 NHE has correct url");
  }

  gBrowser.removeTab(newTab);
});

// Loading the frameset inside an iframe
add_task(async function () {
  let testURL =
    getRootDirectory(gTestPath) + "browser_frame_history_index2.html";
  let tab = BrowserTestUtils.addTab(gBrowser, testURL);
  gBrowser.selectedTab = tab;

  info(
    "iframe: Opening a page with an iframe containing three frames, 5 loads should take place"
  );
  await waitForLoadsInBrowser(tab.linkedBrowser, 5);

  let browser_b = tab.linkedBrowser.contentDocument
    .getElementById("iframe")
    .contentDocument.getElementsByTagName("frame")[1];
  let document_b = browser_b.contentDocument;
  let links = document_b.getElementsByTagName("a");

  // We're going to click on the first link, so listen for another load event
  info("iframe: Clicking on link 1, 1 load should take place");
  let promise = waitForLoadsInBrowser(tab.linkedBrowser, 1);
  EventUtils.sendMouseEvent(
    { type: "click" },
    links[0],
    browser_b.contentWindow
  );
  await promise;

  info("iframe: Clicking on link 2, 1 load should take place");
  promise = waitForLoadsInBrowser(tab.linkedBrowser, 1);
  EventUtils.sendMouseEvent(
    { type: "click" },
    links[1],
    browser_b.contentWindow
  );
  await promise;

  info("iframe: Close then un-close page, 5 loads should take place");
  await promiseRemoveTabAndSessionState(tab);
  let newTab = ss.undoCloseTab(window, 0);
  await waitForLoadsInBrowser(newTab.linkedBrowser, 5);

  info("iframe: Go back in time, 1 load should take place");
  gBrowser.goBack();
  await waitForLoadsInBrowser(newTab.linkedBrowser, 1);

  let expectedURLEnds = ["a.html", "b.html", "c1.html"];
  let frames = newTab.linkedBrowser.contentDocument
    .getElementById("iframe")
    .contentDocument.getElementsByTagName("frame");
  for (let i = 0; i < frames.length; i++) {
    is(
      frames[i].contentDocument.location.href,
      getRootDirectory(gTestPath) +
        "browser_frame_history_" +
        expectedURLEnds[i],
      "frame " + i + " has the right url"
    );
  }
  gBrowser.removeTab(newTab);
});

// Now, test that we don't record history if the iframe is added dynamically
add_task(async function () {
  // Start with an empty history
  let blankState = JSON.stringify({
    windows: [
      {
        tabs: [
          { entries: [{ url: "about:blank", triggeringPrincipal_base64 }] },
        ],
        _closedTabs: [],
      },
    ],
    _closedWindows: [],
  });
  await setBrowserState(blankState);

  let testURL =
    getRootDirectory(gTestPath) + "browser_frame_history_index_blank.html";
  let tab = BrowserTestUtils.addTab(gBrowser, testURL);
  gBrowser.selectedTab = tab;
  await waitForLoadsInBrowser(tab.linkedBrowser, 1);

  info(
    "dynamic: Opening a page with an iframe containing three frames, 4 dynamic loads should take place"
  );
  let doc = tab.linkedBrowser.contentDocument;
  let iframe = doc.createElement("iframe");
  iframe.id = "iframe";
  iframe.src = "browser_frame_history_index.html";
  doc.body.appendChild(iframe);
  await waitForLoadsInBrowser(tab.linkedBrowser, 4);

  let browser_b = tab.linkedBrowser.contentDocument
    .getElementById("iframe")
    .contentDocument.getElementsByTagName("frame")[1];
  let document_b = browser_b.contentDocument;
  let links = document_b.getElementsByTagName("a");

  // We're going to click on the first link, so listen for another load event
  info("dynamic: Clicking on link 1, 1 load should take place");
  let promise = waitForLoadsInBrowser(tab.linkedBrowser, 1);
  EventUtils.sendMouseEvent(
    { type: "click" },
    links[0],
    browser_b.contentWindow
  );
  await promise;

  info("dynamic: Clicking on link 2, 1 load should take place");
  promise = waitForLoadsInBrowser(tab.linkedBrowser, 1);
  EventUtils.sendMouseEvent(
    { type: "click" },
    links[1],
    browser_b.contentWindow
  );
  await promise;

  info("Check in the state that we have not stored this history");
  let state = ss.getBrowserState();
  info(JSON.stringify(JSON.parse(state), null, "\t"));
  is(
    state.indexOf("c1.html"),
    -1,
    "History entry was not stored in the session state"
  );
  gBrowser.removeTab(tab);
});

// helper functions
function waitForLoadsInBrowser(aBrowser, aLoadCount) {
  return new Promise(resolve => {
    let loadCount = 0;
    aBrowser.addEventListener(
      "load",
      function listener() {
        if (++loadCount < aLoadCount) {
          info(
            "Got " + loadCount + " loads, waiting until we have " + aLoadCount
          );
          return;
        }

        aBrowser.removeEventListener("load", listener, true);
        resolve();
      },
      true
    );
  });
}

function timeout(delay, task) {
  return new Promise((resolve, reject) => {
    setTimeout(() => resolve(true), delay);
    task.then(() => resolve(false), reject);
  });
}
