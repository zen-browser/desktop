/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

function boostShareResponse() {
  return {
    id: SHARE_ID,
    expiresAt: null,
    webUrl: `/boost/${SHARE_ID}`,
    link: `${SHARE_BASE}/boost/${SHARE_ID}`,
  };
}

add_task(async function test_find_or_create_share_reuses_link() {
  let creates = 0;
  const restoreCreate = stubMethod(ZenShareClient, "createShare", async () => {
    creates++;
    return boostShareResponse();
  });
  let restoreGet = stubMethod(ZenShareClient, "getShare", async () => ({
    id: SHARE_ID,
  }));

  // Unique content, so entries left in the profile's cache by other runs
  // cannot satisfy this one.
  const doc = structuredClone(BOOST_DOC);
  doc.shared.name = `Cache test ${Date.now()}`;

  const first = await ZenShareClient.findOrCreateShare(doc, { name: "John" });
  Assert.equal(first.reused, false, "the first share is uploaded");
  Assert.equal(creates, 1, "one upload so far");

  const second = await ZenShareClient.findOrCreateShare(doc, { name: "John" });
  Assert.equal(second.reused, true, "the same content reuses the link");
  Assert.equal(second.link, first.link, "and it is the same link");
  Assert.equal(creates, 1, "nothing was uploaded again");

  const otherName = await ZenShareClient.findOrCreateShare(doc, {
    name: "Jane",
  });
  Assert.equal(otherName.reused, false, "a different sharer name uploads");
  Assert.equal(creates, 2, "two uploads");

  const hidden = structuredClone(doc);
  delete hidden.shared.preview;
  const withoutPreview = await ZenShareClient.findOrCreateShare(hidden, {
    name: "John",
  });
  Assert.equal(withoutPreview.reused, false, "hiding the screenshot uploads");
  Assert.equal(creates, 3, "three uploads");

  restoreGet();
  restoreGet = stubMethod(ZenShareClient, "getShare", async () => {
    throw new ZenShareError("not-found", "gone");
  });
  const gone = await ZenShareClient.findOrCreateShare(doc, { name: "John" });
  Assert.equal(gone.reused, false, "a share the server lost is uploaded again");
  Assert.equal(creates, 4, "four uploads");

  restoreGet();
  restoreCreate();
});

add_task(async function test_receive_boost_from_link() {
  const restore = stubSharePreview(BOOST_DOC, "John Zen");
  const tabCount = gBrowser.tabs.length;
  const shareTab = gBrowser.addTrustedTab(`${SHARE_BASE}/boost/${SHARE_ID}`, {
    inBackground: false,
  });
  gBrowser.selectedTab = shareTab;

  await TestUtils.waitForCondition(
    () => gDialogBox.isOpen,
    "the shared boost dialog should open"
  );
  const dialog = gDialogBox.dialog;
  await dialog._dialogReady;
  const frameDoc = dialog._frame.contentDocument;
  Assert.ok(
    frameDoc.documentURI.includes("zen-boost-receive.xhtml"),
    "the receive dialog is shown"
  );
  Assert.ok(!shareTab.isConnected, "the share page's tab is closed");
  Assert.equal(
    frameDoc.querySelector(".zbs-domain").textContent,
    BOOST_DOMAIN,
    "the dialog names the site"
  );
  Assert.equal(
    frameDoc.querySelector(".zbs-name").textContent,
    "Shared Boost",
    "the dialog names the boost"
  );
  Assert.equal(
    frameDoc.querySelector(".zbs-author-name").textContent,
    "John Zen",
    "the dialog names the author"
  );
  Assert.equal(
    frameDoc.querySelectorAll(".zbs-signature path").length,
    1,
    "the signature is drawn"
  );
  Assert.ok(
    frameDoc.querySelector(".zbs-screenshot-image").src.startsWith("data:"),
    "the embedded preview is shown"
  );

  // Accept: the boost is installed for the site and the site opens.
  const closed = TestUtils.waitForCondition(
    () => !gDialogBox.isOpen,
    "the dialog should close"
  );
  frameDoc.querySelector("dialog").acceptDialog();
  await closed;
  await TestUtils.waitForCondition(
    () => gBrowser.tabs.length === tabCount + 1,
    "the boosted site should open in a new tab"
  );
  const siteTab = gBrowser.selectedTab;
  Assert.ok(
    siteTab.linkedBrowser.currentURI.spec.startsWith(
      `https://${BOOST_DOMAIN}/`
    ),
    "the new tab shows the boosted site"
  );
  const boosts = gZenBoostsManager.loadBoostsFromStore(BOOST_DOMAIN) ?? [];
  Assert.equal(boosts.length, 1, "the boost was added for the site");
  Assert.equal(
    boosts[0].boostEntry.boostData.boostName,
    "Shared Boost",
    "with the shared name"
  );
  Assert.equal(
    gZenBoostsManager.getActiveBoostId(BOOST_DOMAIN),
    boosts[0].id,
    "and turned on"
  );

  for (const boost of boosts) {
    gZenBoostsManager.deleteBoost(boost);
  }
  BrowserTestUtils.removeTab(siteTab);
  restore();
});

add_task(async function test_receive_boost_rejects_bad_domain() {
  const bad = structuredClone(BOOST_DOC);
  bad.shared.domain = "trusted.example@attacker.example";
  const restore = stubSharePreview(bad, "John Zen");
  const shareTab = gBrowser.addTrustedTab(`${SHARE_BASE}/boost/${SHARE_ID}`, {
    inBackground: false,
  });
  gBrowser.selectedTab = shareTab;

  await TestUtils.waitForCondition(
    () => document.querySelector("#zen-toast-container .zen-toast"),
    "an error toast should show"
  );
  Assert.ok(!gDialogBox.isOpen, "no dialog opens for a bad domain");
  Assert.ok(shareTab.isConnected, "the share page's tab is left alone");

  BrowserTestUtils.removeTab(shareTab);
  restore();
});
