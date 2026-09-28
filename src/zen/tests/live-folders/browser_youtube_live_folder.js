/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

ChromeUtils.defineESModuleGetters(this, {
  sinon: "resource://testing-common/Sinon.sys.mjs",
  nsYoutubeLiveFolderProvider:
    "resource:///modules/zen/YoutubeLiveFolder.sys.mjs",
  ZenLiveFoldersManager:
    "resource:///modules/zen/ZenLiveFoldersManager.sys.mjs",
});

async function youtubeFixture(name) {
  const response = await fetch(
    `${getRootDirectory(gTestPath)}fixtures/${name}`
  );
  return response.text();
}

function youtubeProvider(sandbox, state = {}) {
  const manager = {
    saveState: sandbox.spy(),
    onLiveFolderFetch: sandbox.spy(),
    getFolderForLiveFolder: () => null,
  };
  const provider = new nsYoutubeLiveFolderProvider({
    id: "youtube-test",
    state: { interval: 1800000, lastFetched: 0, ...state },
    manager,
  });
  sandbox.stub(provider, "fetch");
  return provider;
}

function youtubeVideo(id) {
  return {
    playlistVideoRenderer: {
      videoId: id,
      title: { simpleText: `Video ${id}` },
      shortBylineText: { simpleText: "Channel" },
      isPlayable: true,
    },
  };
}

function youtubePage(contents) {
  return `<script>ytcfg.set({"LOGGED_IN":true});</script><script>ytInitialData = ${JSON.stringify(
    {
      contents: {
        twoColumnBrowseResultsRenderer: {
          tabs: [
            {
              tabRenderer: {
                selected: true,
                content: {
                  sectionListRenderer: {
                    contents: [
                      {
                        itemSectionRenderer: {
                          contents: [
                            {
                              playlistVideoListRenderer: {
                                playlistId: "WL",
                                contents,
                              },
                            },
                          ],
                        },
                      },
                    ],
                  },
                },
              },
            },
          ],
        },
      },
    }
  )};</script>`;
}

add_task(async function test_youtube_pagination_and_mapping() {
  const sandbox = sinon.createSandbox();
  try {
    const provider = youtubeProvider(sandbox);
    sandbox
      .stub(provider, "getSessionHeaders")
      .returns({ Authorization: "fixture-only" });
    provider.fetch.onFirstCall().resolves({
      status: 200,
      text: await youtubeFixture("youtube-watch-later.html"),
    });
    provider.fetch.onSecondCall().resolves({
      status: 200,
      text: await youtubeFixture("youtube-continuation.json"),
    });
    const items = await provider.fetchItems();
    Assert.deepEqual(
      items.map(item => item.id),
      ["AAAAAAAAAAA", "CCCCCCCCCCC"],
      "Deduplicate and exclude unavailable videos and recommendations"
    );
    Assert.equal(items[0].title, 'A title with } braces and "quotes"');
    Assert.equal(items[0].subtitle, "Example channel");
    Assert.equal(items[0].url, "https://www.youtube.com/watch?v=AAAAAAAAAAA");
    Assert.equal(
      window.fixtureScriptExecuted,
      undefined,
      "Page scripts never execute"
    );
    const [url, options] = provider.fetch.secondCall.args;
    Assert.ok(url.startsWith("https://www.youtube.com/youtubei/v1/browse?"));
    Assert.equal(options.method, "POST");
    Assert.equal(JSON.parse(options.body).continuation, "page-two");
    Assert.equal(
      JSON.parse(options.body).context.client.clientVersion,
      "fixture-version"
    );
    Assert.ok(
      !JSON.stringify(provider.serialize()).includes("page-two"),
      "Continuation stays out of persisted state"
    );
  } finally {
    sandbox.restore();
  }
});

add_task(async function test_youtube_limits_and_empty_playlist() {
  const sandbox = sinon.createSandbox();
  try {
    const provider = youtubeProvider(sandbox);
    const videos = Array.from({ length: 501 }, (_, index) =>
      youtubeVideo(String(index).padStart(11, "0"))
    );
    for (const limit of [50, 100, 250, 500]) {
      provider.state.limit = limit;
      provider.fetch.resolves({ status: 200, text: youtubePage(videos) });
      Assert.equal(
        (await provider.fetchItems()).length,
        limit,
        `Respect ${limit} available videos`
      );
    }
    provider.fetch.resolves({ status: 200, text: youtubePage([]) });
    Assert.deepEqual(
      await provider.fetchItems(),
      [],
      "Authenticated playlist with an explicit empty contents array is empty"
    );
    const restored = new nsYoutubeLiveFolderProvider({
      id: provider.id,
      state: provider.serialize().state,
      manager: provider.manager,
    });
    Assert.equal(restored.state.limit, 500, "Video limit survives restoration");
    Assert.equal(
      youtubeProvider(sandbox, { limit: -1 }).state.limit,
      100,
      "Invalid limit uses default"
    );
  } finally {
    sandbox.restore();
  }
});

add_task(async function test_youtube_failure_preservation() {
  const sandbox = sinon.createSandbox();
  try {
    const provider = youtubeProvider(sandbox);
    const original = await youtubeFixture("youtube-watch-later.html");
    const continuation = JSON.parse(
      await youtubeFixture("youtube-continuation.json")
    );
    sandbox.stub(provider, "getSessionHeaders").returns({});
    const failures = [
      [
        {
          status: 200,
          text: '<script>ytcfg.set({"LOGGED_IN":false});</script>',
        },
        "zen-live-folder-youtube-no-auth",
      ],
      [
        { status: 200, url: "https://consent.google.com/m", text: "" },
        "zen-live-folder-youtube-no-auth",
      ],
      [
        { status: 200, text: "<html>Unknown page</html>" },
        "zen-live-folder-youtube-unexpected-response",
      ],
      [{ status: 503, text: "Unavailable" }, "zen-live-folder-failed-fetch"],
      [
        {
          status: 200,
          text: original.replace(
            /"contents"\s*:\s*\[\s*\{"playlistVideoRenderer"/,
            '"brokenContents": [{"playlistVideoRenderer"'
          ),
        },
        "zen-live-folder-youtube-unexpected-response",
      ],
    ];
    for (const [response, expected] of failures) {
      provider.fetch.reset();
      provider.fetch.resolves(response);
      Assert.equal(await provider.refresh(), expected);
      sinon.assert.calledOnce(provider.fetch);
      Assert.equal(
        provider.manager.onLiveFolderFetch.lastCall.args[1],
        expected,
        "Manager receives an error, never an empty or partial list"
      );
    }
    provider.fetch.reset();
    provider.fetch.onFirstCall().resolves({ status: 200, text: original });
    provider.fetch.onSecondCall().rejects(new Error("Network offline"));
    Assert.equal(
      await provider.fetchItems(),
      "zen-live-folder-failed-fetch",
      "Discard partial results when a continuation request fails"
    );
    continuation.onResponseReceivedActions[1].appendContinuationItemsAction.continuationItems.push(
      {
        continuationItemRenderer: {
          continuationEndpoint: { continuationCommand: { token: "page-two" } },
        },
      }
    );
    provider.fetch.reset();
    provider.fetch.onFirstCall().resolves({ status: 200, text: original });
    provider.fetch
      .onSecondCall()
      .resolves({ status: 200, text: JSON.stringify(continuation) });
    Assert.equal(
      await provider.fetchItems(),
      "zen-live-folder-youtube-unexpected-response",
      "Reject repeated continuation tokens"
    );
    sinon.assert.calledTwice(provider.fetch);
    // Exercise the actual manager error path: tabs and dismissals must survive.
    const removeTabs = sandbox.spy();
    const folder = {
      isLiveFolder: true,
      tabs: [{ id: "existing-tab" }],
      resetButton: null,
    };
    sandbox
      .stub(ZenLiveFoldersManager, "getFolderForLiveFolder")
      .returns(folder);
    sandbox
      .stub(ZenLiveFoldersManager, "window")
      .get(() => ({ gBrowser: { removeTabs } }));
    ZenLiveFoldersManager.onLiveFolderFetch(
      provider,
      "zen-live-folder-failed-fetch"
    );
    sinon.assert.notCalled(removeTabs);
    Assert.equal(folder.tabs.length, 1);
  } finally {
    sandbox.restore();
  }
});

add_task(async function test_youtube_container_session_and_recovery() {
  const sandbox = sinon.createSandbox();
  const expiry = Math.floor(Date.now() / 1000) + 3600;
  // Use a separate container so the normal profile's cookies remain untouched.
  const container = ContextualIdentityService.create(
    "YouTube test",
    "fingerprint",
    "blue"
  );
  const attributes = { userContextId: container.userContextId };
  try {
    Services.cookies.add(
      ".youtube.com",
      "/",
      "SAPISID",
      "isolated-test-secret",
      true,
      false,
      false,
      expiry,
      attributes,
      Ci.nsICookie.SAMESITE_NONE,
      Ci.nsICookie.SCHEME_HTTPS
    );
    const provider = youtubeProvider(sandbox);
    sandbox.stub(provider.manager, "getFolderForLiveFolder").returns({
      documentGlobal: {
        gZenWorkspaces: {
          getWorkspaceFromId: () => ({
            containerTabId: container.userContextId,
          }),
        },
      },
      getAttribute: () => "workspace",
    });
    const { config, initial } = provider.parsePage(
      await youtubeFixture("youtube-watch-later.html")
    );
    const headers = provider.getSessionHeaders(config, initial);
    Assert.ok(headers.Authorization.startsWith("SAPISIDHASH "));
    Assert.ok(headers.Authorization.endsWith("_u"));
    const timestamp = headers.Authorization.split(" ")[1].split("_")[0];
    const digest = await window.crypto.subtle.digest(
      "SHA-1",
      new TextEncoder().encode(
        `user-id ${timestamp} isolated-test-secret https://www.youtube.com`
      )
    );
    const hex = Array.from(new Uint8Array(digest), byte =>
      byte.toString(16).padStart(2, "0")
    ).join("");
    Assert.equal(
      headers.Authorization,
      `SAPISIDHASH ${timestamp}_${hex}_u`,
      "Authentication uses only the isolated container's cookie"
    );
    Assert.equal(headers["X-Goog-AuthUser"], "2");
    Assert.equal(headers["X-Goog-PageId"], "channel-id");
    Assert.ok(
      !JSON.stringify(provider.serialize()).includes("isolated-test-secret")
    );
    const browser = { addTrustedTab: sandbox.stub().returns({}) };
    provider.manager.window = { gBrowser: browser };
    provider.onActionButtonClick("zen-live-folder-youtube-no-auth");
    Assert.equal(
      browser.addTrustedTab.firstCall.args[1].userContextId,
      container.userContextId,
      "Recovery uses the folder's container"
    );
  } finally {
    Services.cookies.remove(".youtube.com", "SAPISID", "/", attributes);
    ContextualIdentityService.remove(container.userContextId);
    sandbox.restore();
  }
});

add_task(async function test_youtube_overlapping_refreshes() {
  const sandbox = sinon.createSandbox();
  try {
    const provider = youtubeProvider(sandbox);
    let resolve;
    provider.fetch.returns(
      new Promise(done => {
        resolve = done;
      })
    );
    const first = provider.refresh();
    const second = provider.refresh();
    sinon.assert.calledOnce(provider.fetch);
    resolve({ status: 200, text: youtubePage([]) });
    await Promise.all([first, second]);
    sinon.assert.calledOnce(provider.manager.onLiveFolderFetch);
  } finally {
    sandbox.restore();
  }
});

add_task(async function test_live_folder_post_and_container_cookies() {
  const { HttpServer } = ChromeUtils.importESModule(
    "resource://testing-common/httpd.sys.mjs"
  );
  const { nsZenLiveFolderProvider } = ChromeUtils.importESModule(
    "resource:///modules/zen/ZenLiveFolder.sys.mjs"
  );
  const { NetUtil } = ChromeUtils.importESModule(
    "resource://gre/modules/NetUtil.sys.mjs"
  );
  const server = new HttpServer();
  let lastRequest;
  server.registerPathHandler("/browse", (request, response) => {
    const length = request.bodyInputStream.available();
    lastRequest = {
      method: request.method,
      cookie: request.hasHeader("Cookie") ? request.getHeader("Cookie") : "",
      body: length
        ? NetUtil.readInputStreamToString(request.bodyInputStream, length, {
            charset: "UTF-8",
          })
        : "",
    };
    response.setHeader("Content-Type", "application/json");
    response.write('{"ok":true}');
  });
  server.start(-1);
  const container = ContextualIdentityService.create(
    "YouTube network test",
    "fingerprint",
    "blue"
  );
  const attributes = { userContextId: container.userContextId };
  const expiry = Math.floor(Date.now() / 1000) + 3600;
  try {
    Services.cookies.add(
      "127.0.0.1",
      "/",
      "zenYoutubeContainer",
      "isolated",
      false,
      false,
      false,
      expiry,
      attributes,
      Ci.nsICookie.SAMESITE_NONE,
      Ci.nsICookie.SCHEME_HTTP
    );
    const manager = {
      getFolderForLiveFolder: () => ({
        getAttribute: () => "workspace",
        documentGlobal: {
          gZenWorkspaces: {
            getWorkspaceFromId: () => ({
              containerTabId: container.userContextId,
            }),
          },
        },
      }),
    };
    const provider = new nsZenLiveFolderProvider({
      id: "post-test",
      state: {},
      manager,
    });
    const url = `http://127.0.0.1:${server.identity.primaryPort}/browse`;
    const body = JSON.stringify({
      title: "Grüße 日本語",
      continuation: "fixture",
    });
    await provider.fetch(url, {
      method: "POST",
      body,
      headers: { "Content-Type": "application/json" },
    });
    Assert.equal(lastRequest.method, "POST");
    Assert.equal(lastRequest.body, body, "POST JSON is encoded as UTF-8");
    Assert.ok(
      lastRequest.cookie.includes("zenYoutubeContainer=isolated"),
      "Request includes only the workspace container's cookie"
    );
    manager.getFolderForLiveFolder = () => null;
    await provider.fetch(url);
    Assert.equal(
      lastRequest.method,
      "GET",
      "Existing GET behavior remains the default"
    );
    Assert.ok(
      !lastRequest.cookie.includes("zenYoutubeContainer"),
      "Default container cannot see the other container's cookie"
    );
  } finally {
    Services.cookies.remove(
      "127.0.0.1",
      "zenYoutubeContainer",
      "/",
      attributes
    );
    ContextualIdentityService.remove(container.userContextId);
    await new Promise(resolve => server.stop(resolve));
  }
});

add_task(async function test_youtube_local_order_dismissals_and_updates() {
  const sandbox = sinon.createSandbox();
  try {
    const provider = youtubeProvider(sandbox);
    function makeTab(id) {
      const attributes = new Map([
        ["zen-live-folder-item-id", `youtube-test:${id}`],
      ]);
      return {
        getAttribute: name => attributes.get(name),
        setAttribute: (name, value) => attributes.set(name, value),
      };
    }
    const first = makeTab("AAAAAAAAAAA");
    const second = makeTab("BBBBBBBBBBB");
    const outdated = makeTab("DDDDDDDDDDD");
    const folder = {
      isLiveFolder: true,
      resetButton: null,
      tabs: [second, first, outdated], // Locally reordered.
      collapsed: true,
      getAttribute: () => "workspace",
      documentGlobal: { gZenWorkspaces: { getWorkspaceFromId: () => null } },
      addTabs(tabs) {
        this.tabs.push(...tabs);
      },
    };
    const dismissed = new Set(["youtube-test:CCCCCCCCCCC"]);
    sandbox.stub(ZenLiveFoldersManager, "dismissedItems").value(dismissed);
    sandbox
      .stub(ZenLiveFoldersManager, "getFolderForLiveFolder")
      .returns(folder);
    sandbox.stub(ZenLiveFoldersManager, "saveState");
    const browser = {
      removeTabs(tabs) {
        folder.tabs = folder.tabs.filter(tab => !tabs.includes(tab));
      },
      addTrustedTab: sandbox.stub().callsFake(() => makeTab("new")),
      pinTab: sandbox.spy(),
    };
    sandbox
      .stub(ZenLiveFoldersManager, "window")
      .get(() => ({ gBrowser: browser }));
    const items = [
      "AAAAAAAAAAA",
      "BBBBBBBBBBB",
      "CCCCCCCCCCC",
      "EEEEEEEEEEE",
    ].map(id => ({
      id,
      title: id,
      url: `https://www.youtube.com/watch?v=${id}`,
    }));
    ZenLiveFoldersManager.onLiveFolderFetch(provider, items);
    await TestUtils.waitForCondition(
      () => folder.tabs.length === 3,
      "New video is added asynchronously"
    );
    Assert.equal(folder.tabs[0], second, "Keep the local tab order");
    Assert.equal(folder.tabs[1], first);
    Assert.equal(
      folder.tabs[2].getAttribute("zen-live-folder-item-id"),
      "youtube-test:EEEEEEEEEEE",
      "Append newly available videos"
    );
    Assert.ok(
      !folder.tabs.includes(outdated),
      "Remove videos outside the mirrored portion"
    );
    Assert.ok(
      dismissed.has("youtube-test:CCCCCCCCCCC"),
      "Preserve local dismissal while the video is still present"
    );
    sinon.assert.calledOnce(browser.addTrustedTab);
    Assert.ok(
      browser.addTrustedTab.firstCall.args[1].createLazyBrowser,
      "Create lazy tabs"
    );
  } finally {
    sandbox.restore();
  }
});

add_task(async function test_youtube_limit_across_pages_and_container_change() {
  const sandbox = sinon.createSandbox();
  try {
    const provider = youtubeProvider(sandbox, { limit: 50 });
    const original = await youtubeFixture("youtube-watch-later.html");
    const continuation = JSON.parse(
      await youtubeFixture("youtube-continuation.json")
    );
    sandbox.stub(provider, "getSessionHeaders").returns({});
    const contents =
      continuation.onResponseReceivedActions[1].appendContinuationItemsAction
        .continuationItems;
    contents.push(
      ...Array.from({ length: 60 }, (_, index) =>
        youtubeVideo(String(index).padStart(11, "0"))
      )
    );
    contents.push({
      continuationItemRenderer: {
        continuationEndpoint: {
          continuationCommand: { token: "unused-next-page" },
        },
      },
    });
    provider.fetch.onFirstCall().resolves({ status: 200, text: original });
    provider.fetch
      .onSecondCall()
      .resolves({ status: 200, text: JSON.stringify(continuation) });
    const items = await provider.fetchItems();
    Assert.equal(items.length, 50, "Fetch enough pages for the selected limit");
    Assert.equal(items[0].id, "AAAAAAAAAAA");
    Assert.equal(items[1].id, "CCCCCCCCCCC");
    sinon.assert.calledTwice(provider.fetch);
    provider.fetch.reset();
    let container = 0;
    sandbox.stub(provider, "userContextId").get(() => container);
    provider.fetch.callsFake(async () => {
      container = 10;
      return { status: 200, text: original };
    });
    Assert.equal(
      await provider.fetchItems(),
      "zen-live-folder-failed-fetch",
      "Discard data if the workspace container changes during a request"
    );
    sinon.assert.calledOnce(provider.fetch);
  } finally {
    sandbox.restore();
  }
});
