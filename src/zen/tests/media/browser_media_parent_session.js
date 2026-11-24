/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const PARENT_MEDIA_PAGE =
  getRootDirectory(gTestPath).replace(
    "chrome://mochitests/content",
    "https://example.org"
  ) + "file_media_parent.html";

async function setContextMetadata(context, metadata) {
  const updated = TestUtils.topicObserved(
    "media-session-controller-metadata-changed"
  );
  await SpecialPowers.spawn(context, [metadata], meta => {
    content.navigator.mediaSession.metadata = meta
      ? new content.MediaMetadata(meta)
      : null;
  });
  await updated;
}

async function setContextPlaybackState(context, state) {
  const updated = TestUtils.topicObserved(
    "media-session-controller-metadata-changed"
  );
  await SpecialPowers.spawn(context, [state], value => {
    content.navigator.mediaSession.playbackState = value;
    // A metadata update provides the same IPC barrier as setContextAction.
    const previous = content.navigator.mediaSession.metadata;
    content.navigator.mediaSession.metadata = new content.MediaMetadata(
      previous
        ? {
            title: previous.title,
            artist: previous.artist,
            album: previous.album,
          }
        : {}
    );
  });
  await updated;
}

async function playEmbeddedVideo(browser) {
  const frame = browser.browsingContext.children[0];
  await SpecialPowers.spawn(frame, [VIDEO_SELECTOR], async selector => {
    await content.document.querySelector(selector).play();
  });
  await TestUtils.waitForCondition(
    () =>
      browser.ownerGlobal.gBrowser.getTabForBrowser(browser).soundPlaying &&
      browser.browsingContext.mediaController.isPlaying,
    "embedded video is playing"
  );
  return frame;
}

add_setup(async function () {
  await SpecialPowers.pushPrefEnv({
    set: [
      ["media.autoplay.default", 0],
      ["media.mediacontrol.testingevents.enabled", true],
    ],
  });
});

add_task(async function test_parent_labels_cross_origin_playback() {
  const originalTab = gBrowser.selectedTab;
  const tab = await BrowserTestUtils.openNewForegroundTab(
    gBrowser,
    PARENT_MEDIA_PAGE
  );
  const browser = tab.linkedBrowser;
  const frame = browser.browsingContext.children[0];
  Assert.notEqual(
    browser.browsingContext.currentWindowGlobal.documentPrincipal.origin,
    frame.currentWindowGlobal.documentPrincipal.origin,
    "the player is in a different origin from the embedding page"
  );

  try {
    await setContextMetadata(browser, {
      title: "Custom playback title",
      artist: "Custom artist",
      album: "Custom album",
    });
    await setContextMetadata(frame, {
      title: "Embedded video title",
      artist: "Embedded artist",
    });
    await setContextPlaybackState(browser, "playing");
    await playEmbeddedVideo(browser);
    await BrowserTestUtils.switchTab(gBrowser, originalTab);
    await waitForMediaBarVisible();
    await TestUtils.waitForCondition(
      () => frontMediaCard()?.browser === browser,
      "the media card belongs to the embedding tab"
    );

    const card = frontMediaCard().element;
    const title = card.querySelector(".zen-media-title");
    const artist = card.querySelector(".zen-media-artist");
    const controller = browser.browsingContext.mediaController;
    await TestUtils.waitForCondition(
      () => title.textContent === "Custom playback title",
      "the parent page labels the cross-origin player's media card"
    );
    Assert.equal(artist.textContent, "Custom artist", "parent artist is shown");
    Assert.equal(
      controller.getMetadata().album,
      "Custom album",
      "metadata fields come from the same session"
    );

    await setContextMetadata(browser, { title: "Updated custom title" });
    await TestUtils.waitForCondition(
      () => title.textContent === "Updated custom title",
      "parent metadata changes refresh the card while the iframe plays"
    );
    Assert.equal(artist.textContent, "", "the iframe artist is not mixed in");
    await setContextPlaybackState(browser, "paused");
    Assert.equal(
      controller.getMetadata().title,
      "Updated custom title",
      "a playback claim survives pause for the same player"
    );
    await SpecialPowers.spawn(frame, [VIDEO_SELECTOR], selector => {
      content.document.querySelector(selector).pause();
    });
    await waitForEmbeddedPaused(frame, true);
    Assert.equal(controller.getMetadata().title, "Updated custom title");
    await SpecialPowers.spawn(frame, [VIDEO_SELECTOR], async selector => {
      await content.document.querySelector(selector).play();
    });

    await setContextMetadata(frame, {
      title: "Updated embedded title",
      artist: "Updated embedded artist",
    });
    Assert.equal(
      controller.getMetadata().title,
      "Updated custom title",
      "player metadata changes do not replace the parent label"
    );

    await setContextPlaybackState(browser, "none");
    await TestUtils.waitForCondition(
      () => title.textContent === "Updated embedded title",
      "declaring none releases the playback claim"
    );
    await setContextPlaybackState(browser, "playing");
    await TestUtils.waitForCondition(
      () => title.textContent === "Updated custom title",
      "the parent can explicitly claim playback again"
    );
    await setContextMetadata(browser, null);
    await TestUtils.waitForCondition(
      () => title.textContent === "Updated embedded title",
      "clearing parent metadata restores the player's latest title"
    );
    Assert.equal(artist.textContent, "Updated embedded artist");

    await setContextMetadata(browser, { artist: "Untitled parent" });
    Assert.equal(
      controller.getMetadata().title,
      "Updated embedded title",
      "a parent session without a title leaves the player metadata in use"
    );

    await setContextMetadata(browser, { title: "Paused parent" });
    await setContextPlaybackState(browser, "paused");
    const newFrameLoaded = BrowserTestUtils.browserLoaded(
      browser,
      true,
      MEDIA_PAGE
    );
    await SpecialPowers.spawn(browser, [], () => {
      const frame = content.document.querySelector("iframe").cloneNode();
      content.document.body.appendChild(frame);
    });
    await newFrameLoaded;
    const otherFrame = browser.browsingContext.children[1];
    await setContextMetadata(otherFrame, { title: "Another embedded player" });
    await SpecialPowers.spawn(otherFrame, [VIDEO_SELECTOR], async selector => {
      await content.document.querySelector(selector).play();
    });
    await TestUtils.waitForCondition(
      () => controller.getMetadata().title === "Another embedded player",
      "a paused parent's old claim does not capture a different player"
    );
  } finally {
    BrowserTestUtils.removeTab(tab);
    gBrowser.selectedTab = originalTab;
  }
});

// The metadata testing notification follows action registration over the same
// IPC channel, so it also serves as a barrier for action changes. Keep it empty
// to test handler delegation independently of a parent's custom title.
async function setContextAction(context, action, enabled) {
  const updated = TestUtils.topicObserved(
    "media-session-controller-metadata-changed"
  );
  await SpecialPowers.spawn(context, [action, enabled], (name, install) => {
    content.wrappedJSObject.mediaActions ??= [];
    content.navigator.mediaSession.setActionHandler(
      name,
      install
        ? details => {
            content.wrappedJSObject.mediaActions.push(details.action);
            content.wrappedJSObject.lastMediaAction = {
              action: details.action,
              seekTime: details.seekTime,
            };
          }
        : null
    );
    content.navigator.mediaSession.metadata = new content.MediaMetadata();
  });
  await updated;
}

async function contextActions(context, minimum = 0) {
  return SpecialPowers.spawn(context, [minimum], async count => {
    await ContentTaskUtils.waitForCondition(
      () => (content.wrappedJSObject.mediaActions?.length ?? 0) >= count,
      "the requested media commands have been delivered"
    );
    return Array.from(content.wrappedJSObject.mediaActions ?? []);
  });
}

async function waitForEmbeddedPaused(frame, paused) {
  await SpecialPowers.spawn(
    frame,
    [VIDEO_SELECTOR, paused],
    async (selector, expected) => {
      await ContentTaskUtils.waitForCondition(
        () => content.document.querySelector(selector).paused === expected,
        "the embedded player's paused state matches the media command"
      );
    }
  );
}

add_task(async function test_parent_actions_and_per_action_fallback() {
  const originalTab = gBrowser.selectedTab;
  const tab = await BrowserTestUtils.openNewForegroundTab(
    gBrowser,
    PARENT_MEDIA_PAGE
  );
  const browser = tab.linkedBrowser;
  const frame = browser.browsingContext.children[0];
  try {
    await setContextMetadata(frame, { title: "Embedded player" });
    await playEmbeddedVideo(browser);
    await BrowserTestUtils.switchTab(gBrowser, originalTab);
    await waitForMediaBarVisible();
    await TestUtils.waitForCondition(
      () => frontMediaCard()?.browser === browser,
      "the media card belongs to the embedding tab"
    );
    const card = frontMediaCard().element;
    const previous = card.querySelector(".zen-media-previoustrack-button");
    const next = card.querySelector(".zen-media-nexttrack-button");
    Assert.ok(previous.disabled, "previous starts disabled without a handler");
    Assert.ok(next.disabled, "next starts disabled without a handler");

    await setContextAction(browser, "previoustrack", true);
    await setContextAction(browser, "nexttrack", true);
    Assert.ok(previous.disabled, "unclaimed parent handlers are not exposed");
    Assert.ok(next.disabled, "unclaimed parent handlers are not exposed");
    await setContextPlaybackState(browser, "playing");
    await TestUtils.waitForCondition(
      () => !previous.disabled && !next.disabled,
      "parent handlers enable previous and next during embedded playback"
    );
    clickMediaButton("zen-media-previoustrack-button");
    clickMediaButton("zen-media-nexttrack-button");
    Assert.deepEqual(await contextActions(browser, 2), [
      "previoustrack",
      "nexttrack",
    ]);
    Assert.deepEqual(await contextActions(frame), []);

    await setContextAction(frame, "nexttrack", true);
    clickMediaButton("zen-media-nexttrack-button");
    Assert.deepEqual(await contextActions(browser, 3), [
      "previoustrack",
      "nexttrack",
      "nexttrack",
    ]);
    Assert.deepEqual(
      await contextActions(frame),
      [],
      "a conflicting player handler does not also receive the command"
    );

    await setContextAction(browser, "nexttrack", false);
    clickMediaButton("zen-media-nexttrack-button");
    Assert.deepEqual(
      await contextActions(frame, 1),
      ["nexttrack"],
      "removing the parent's handler restores the player's handler"
    );
    Assert.equal((await contextActions(browser)).length, 3);
    Assert.ok(!previous.disabled, "the parent's other handler stays enabled");

    await setContextAction(frame, "nexttrack", false);
    await TestUtils.waitForCondition(
      () => next.disabled,
      "next becomes disabled when neither session has a handler"
    );
    await setContextAction(browser, "previoustrack", false);
    await TestUtils.waitForCondition(
      () => previous.disabled,
      "removing a parent-only handler disables its button"
    );

    // A custom pause handler deliberately records the command without pausing.
    // The default player action must not run in addition to that handler.
    await setContextAction(browser, "pause", true);
    clickMediaButton("zen-media-playpause-button");
    Assert.equal((await contextActions(browser, 4))[3], "pause");
    Assert.equal(
      await SpecialPowers.spawn(frame, [VIDEO_SELECTOR], selector => {
        return content.document.querySelector(selector).paused;
      }),
      false,
      "a parent handler suppresses the embedded player's default action"
    );

    await setContextAction(browser, "pause", false);
    clickMediaButton("zen-media-playpause-button");
    await waitForEmbeddedPaused(frame, true);
    await TestUtils.waitForCondition(
      () => !card.classList.contains("playing"),
      "the card reflects the embedded player's paused state"
    );
    clickMediaButton("zen-media-playpause-button");
    await waitForEmbeddedPaused(frame, false);
    Assert.equal(
      (await contextActions(browser)).length,
      4,
      "unhandled play and pause keep the existing default behavior"
    );

    const controller = browser.browsingContext.mediaController;
    await setContextAction(browser, "seekto", true);
    controller.seekTo(12, false);
    Assert.equal((await contextActions(browser, 5))[4], "seekto");
    Assert.equal(
      await SpecialPowers.spawn(browser, [], () => {
        return content.wrappedJSObject.lastMediaAction.seekTime;
      }),
      12,
      "delegating seek preserves its parameters"
    );

    await setContextAction(browser, "stop", true);
    controller.stop();
    Assert.equal((await contextActions(browser, 6))[5], "stop");
    Assert.equal(
      await SpecialPowers.spawn(frame, [VIDEO_SELECTOR], selector => {
        return content.document.querySelector(selector).paused;
      }),
      false,
      "delegated stop does not also stop the embedded player"
    );
  } finally {
    BrowserTestUtils.removeTab(tab);
    gBrowser.selectedTab = originalTab;
  }
});

add_task(async function test_unclaimed_parent_does_not_capture_playback() {
  await BrowserTestUtils.withNewTab(PARENT_MEDIA_PAGE, async browser => {
    const frame = browser.browsingContext.children[0];
    await setContextAction(browser, "nexttrack", true);
    await setContextAction(browser, "pause", true);
    await setContextMetadata(browser, { title: "Unrelated parent player" });
    await setContextMetadata(frame, { title: "Playing embedded video" });
    await playEmbeddedVideo(browser);
    const controller = browser.browsingContext.mediaController;

    for (const state of ["none", "paused"]) {
      await setContextPlaybackState(browser, state);
      Assert.equal(
        controller.getMetadata().title,
        "Playing embedded video",
        `an unclaimed ${state} parent does not replace player metadata`
      );
      Assert.ok(
        !controller.supportedKeys.includes("nexttrack"),
        `an unclaimed ${state} parent's handler is not exposed`
      );
      controller.pause("user");
      await waitForEmbeddedPaused(frame, true);
      Assert.deepEqual(
        await contextActions(browser),
        [],
        "an ordinary broadcast does not invoke the inactive parent's handler"
      );
      controller.play();
      await waitForEmbeddedPaused(frame, false);
      await TestUtils.waitForCondition(
        () => controller.isPlaying,
        "the embedded player has resumed"
      );
    }

    await setContextPlaybackState(browser, "playing");
    Assert.equal(controller.getMetadata().title, "Unrelated parent player");
    await TestUtils.waitForCondition(
      () => controller.supportedKeys.includes("nexttrack"),
      "an explicit playback claim enables parent delegation"
    );
  });
});

add_task(async function test_same_origin_parent_delegation() {
  const sameOriginPage = PARENT_MEDIA_PAGE.replace(
    "https://example.org",
    "https://example.com"
  );
  await BrowserTestUtils.withNewTab(sameOriginPage, async browser => {
    const frame = browser.browsingContext.children[0];
    await setContextAction(browser, "nexttrack", true);
    await setContextMetadata(browser, { title: "Same-origin parent" });
    await setContextMetadata(frame, { title: "Same-origin player" });
    await setContextPlaybackState(browser, "playing");
    await playEmbeddedVideo(browser);
    const controller = browser.browsingContext.mediaController;
    await TestUtils.waitForCondition(
      () => controller.getMetadata().title === "Same-origin parent",
      "same-origin embedded playback uses the claimed parent metadata"
    );
    await TestUtils.waitForCondition(
      () => controller.supportedKeys.includes("nexttrack"),
      "the same-origin parent handler is available"
    );
    controller.nextTrack();
    Assert.deepEqual(await contextActions(browser, 1), ["nexttrack"]);
    Assert.deepEqual(await contextActions(frame), []);
  });
});

add_task(async function test_sessionless_iframe_keeps_existing_behavior() {
  await BrowserTestUtils.withNewTab(PARENT_MEDIA_PAGE, async browser => {
    await setContextAction(browser, "nexttrack", true);
    await setContextMetadata(browser, { title: "Parent label" });
    await setContextPlaybackState(browser, "playing");
    // Deliberately do not access navigator.mediaSession in the child.
    await playEmbeddedVideo(browser);
    const controller = browser.browsingContext.mediaController;
    Assert.notEqual(
      controller.getMetadata().title,
      "Parent label",
      "delegation currently requires a registered embedded media session"
    );
    Assert.ok(
      !controller.supportedKeys.includes("nexttrack"),
      "a sessionless iframe retains the existing supported-action policy"
    );
  });
});

add_task(async function test_private_parent_metadata_stays_hidden() {
  await SpecialPowers.pushPrefEnv({
    set: [["media.privatebrowsing.metadata.enabled", false]],
  });
  const privateWindow = await BrowserTestUtils.openNewBrowserWindow({
    private: true,
  });
  try {
    const tab = await BrowserTestUtils.openNewForegroundTab(
      privateWindow.gBrowser,
      PARENT_MEDIA_PAGE
    );
    const browser = tab.linkedBrowser;
    await setContextMetadata(browser, {
      title: "Private parent title",
      artist: "Private parent artist",
    });
    await setContextMetadata(browser.browsingContext.children[0], {
      title: "Private embedded title",
    });
    await setContextPlaybackState(browser, "playing");
    await playEmbeddedVideo(browser);
    const metadata = browser.browsingContext.mediaController.getMetadata();
    Assert.notEqual(metadata.title, "Private parent title");
    Assert.notEqual(metadata.title, "Private embedded title");
    Assert.equal(metadata.artist, "", "private playback identity is hidden");
  } finally {
    await BrowserTestUtils.closeWindow(privateWindow);
    await SpecialPowers.popPrefEnv();
  }
});
