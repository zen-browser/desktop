/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const PEER_PAGE = "https://example.com/";

function sharingCards() {
  return [...mediaBar().querySelectorAll(".zen-media-card[media-sharing]")];
}

async function waitForSharingCards(count, message) {
  await TestUtils.waitForCondition(
    () => sharingCards().length === count,
    message
  );
}

async function addPeerConnectionTab(win = window) {
  const tab = BrowserTestUtils.addTab(win.gBrowser, PEER_PAGE, {
    skipAnimation: true,
  });
  await BrowserTestUtils.browserLoaded(tab.linkedBrowser);
  await SpecialPowers.spawn(tab.linkedBrowser, [], async () => {
    const pc = new content.RTCPeerConnection();
    content.wrappedJSObject.__zenPeerConnection = pc;
    pc.createDataChannel("zen");
    await pc.setLocalDescription(await pc.createOffer());
  });
  await TestUtils.waitForCondition(
    () =>
      tab.linkedBrowser.browsingContext.currentWindowGlobal.hasActivePeerConnections(),
    "the tab reports an active peer connection"
  );
  registerCleanupFunction(() => closePeerConnectionTab(tab));
  return tab;
}

async function closePeerConnection(tab) {
  if (!tab.isConnected || !tab.linkedBrowser?.browsingContext) {
    return;
  }
  await SpecialPowers.spawn(tab.linkedBrowser, [], () => {
    content.wrappedJSObject.__zenPeerConnection?.close();
  });
}

async function closePeerConnectionTab(tab) {
  await closePeerConnection(tab);
  if (tab.isConnected) {
    BrowserTestUtils.removeTab(tab);
  }
}

function setSharing(tab, sharing, win = window) {
  win.gZenMediaController.updateMediaSharing({
    windowId: tab.linkedBrowser.innerWindowID,
    showCameraIndicator: sharing,
    showMicrophoneIndicator: false,
  });
}

add_task(async function test_twoSharingTabsKeepTheirOwnCards() {
  const first = await addPeerConnectionTab();
  const second = await addPeerConnectionTab();
  registerCleanupFunction(() => gZenMediaController.closeAllCards());

  setSharing(first, true);
  await waitForSharingCards(1, "the first sharing tab gets a card");
  Assert.equal(sharingCards().length, 1, "One tab sharing, one card");

  setSharing(second, true);
  await waitForSharingCards(2, "the second sharing tab gets its own card");
  Assert.equal(
    sharingCards().length,
    2,
    "A second sharing tab adds a card rather than replacing the first one's"
  );
  Assert.equal(
    visibleMediaCards().length,
    2,
    "Both sharing cards are visible, stacked rather than replaced"
  );
  Assert.ok(
    sharingCards().some(card => card.hasAttribute("stacked-behind")),
    "The older card is the one stacked behind"
  );

  setSharing(first, false);
  await waitForSharingCards(1, "the tab that stopped loses its card");
  Assert.equal(
    sharingCards().length,
    1,
    "Stopping one share removes exactly one card"
  );
  Assert.equal(
    gZenMediaController.frontCard.browser.browserId,
    second.linkedBrowser.browserId,
    "The card left behind belongs to the tab that is still sharing"
  );

  setSharing(second, false);
  await waitForSharingCards(0, "the last sharing card is removed too");
  Assert.equal(sharingCards().length, 0, "No sharing card is left behind");
});

add_task(async function test_barStaysVisibleWhenAHideIsInterrupted() {
  const first = await addPeerConnectionTab();
  const second = await addPeerConnectionTab();
  registerCleanupFunction(() => gZenMediaController.closeAllCards());

  setSharing(first, true);
  await waitForSharingCards(1, "a card is showing");

  gZenMediaController.hideMediaControls();

  await TestUtils.waitForCondition(
    () => window.getComputedStyle(mediaBar()).opacity === "1",
    "the bar becomes opaque again after the interrupted hide"
  );
  Assert.ok(
    !mediaBar().hasAttribute("hidden"),
    "The bar is still showing for the card that came back"
  );
  Assert.equal(
    window.getComputedStyle(mediaBar()).opacity,
    "1",
    "The bar is not left invisible"
  );

  setSharing(first, false);
  await waitForSharingCards(0, "cleaned up");
});
