/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const { ZenTabCapture } = ChromeUtils.importESModule(
  "resource:///modules/zen/media/ZenTabCapture.sys.mjs"
);
const { webrtcUI } = ChromeUtils.importESModule(
  "resource:///modules/webrtcUI.sys.mjs"
);

async function addTab() {
  const tab = BrowserTestUtils.addTab(gBrowser, "https://example.com/", {
    skipAnimation: true,
  });
  await BrowserTestUtils.browserLoaded(tab.linkedBrowser);
  registerCleanupFunction(() => BrowserTestUtils.removeTab(tab));
  return tab;
}

function startFakeTabCapture(tab) {
  const stream = {
    state: {
      devices: [
        { mediaSource: "browser", rawId: String(tab.linkedBrowser.browserId) },
      ],
    },
  };
  webrtcUI._streams.push(stream);
  ZenTabCapture.update();
  return () => {
    webrtcUI._streams.splice(webrtcUI._streams.indexOf(stream), 1);
    ZenTabCapture.update();
  };
}

add_task(async function test_shareThisTabMovesTheCapture() {
  const captured = await addTab();
  const other = await addTab();
  const selectedBefore = gBrowser.selectedTab;

  const stopCapture = startFakeTabCapture(captured);
  Assert.ok(
    document.documentElement.hasAttribute("zen-tab-capture-active"),
    "The window knows a tab capture is running"
  );
  Assert.ok(
    captured.hasAttribute("zen-tab-captured"),
    "The captured tab is marked"
  );
  Assert.ok(!other.hasAttribute("zen-tab-captured"), "Other tabs are not");

  other.querySelector(".zen-tab-share-button").click();
  Assert.ok(
    other.hasAttribute("zen-tab-captured"),
    "Share this tab marks the clicked tab"
  );
  Assert.ok(
    !captured.hasAttribute("zen-tab-captured"),
    "The previous tab is no longer marked"
  );
  Assert.equal(
    gBrowser.selectedTab,
    selectedBefore,
    "Switching the capture does not switch tabs"
  );

  stopCapture();
  Assert.ok(
    !document.documentElement.hasAttribute("zen-tab-capture-active"),
    "Stopping the capture clears the window state"
  );
  Assert.ok(
    !other.hasAttribute("zen-tab-captured"),
    "Stopping the capture clears the tab mark"
  );
});
