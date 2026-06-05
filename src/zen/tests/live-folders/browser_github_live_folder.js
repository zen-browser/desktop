/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

ChromeUtils.defineESModuleGetters(this, {
  sinon: "resource://testing-common/Sinon.sys.mjs",
  nsGithubLiveFolderProvider:
    "resource:///modules/zen/GithubLiveFolder.sys.mjs",
});

function getGithubProviderForTest(sandbox, customOptions = {}) {
  const defaultOptions = {
    authorMe: true,
    assignedMe: false,
    reviewRequested: false,
    ...customOptions,
  };

  const mockManager = {
    saveState: sandbox.spy(),
  };

  const initialState = {
    interval: 60,
    maxItems: 10,
    lastFetched: 0,
    type: customOptions.type,
    options: defaultOptions,
  };

  let instance = new nsGithubLiveFolderProvider({
    id: "test-github-folder",
    state: initialState,
    manager: mockManager,
  });

  sandbox.stub(instance, "fetch");
  return instance;
}

add_task(async function test_fetch_items_url_construction() {
  info(
    "should construct the correct GitHub search URL based on default options"
  );

  let sandbox = sinon.createSandbox();

  let instance = getGithubProviderForTest(sandbox, {
    authorMe: true,
    assignedMe: false,
    reviewRequested: false,
    type: "pull-requests",
  });

  instance.fetch.resolves({
    status: 200,
    text: "<html></html>",
  });

  await instance.fetchItems();

  Assert.ok(instance.fetch.calledOnce, "Fetch should be called once");

  const fetchedUrl = new URL(instance.fetch.firstCall.args[0]);
  const searchParams = fetchedUrl.searchParams;

  Assert.ok(fetchedUrl.href.startsWith("https://github.com/pulls"));

  const query = searchParams.get("q");
  Assert.ok(query.includes("is:open"), "Should include state:open");
  Assert.ok(query.includes("is:pr"), "Should include is:PR");
  Assert.ok(query.includes("author:@me"), "Should include author:@me");
  Assert.ok(!query.includes("assignee:@me"), "Should NOT include assignee:@me");
  Assert.ok(
    !query.includes("review-requested:@me"),
    "Should NOT include review-requested"
  );

  sandbox.restore();
});

add_task(async function test_fetch_items_url_complex_options() {
  info("should construct query with multiple enabled options");

  let sandbox = sinon.createSandbox();

  let instance = getGithubProviderForTest(sandbox, {
    authorMe: true,
    assignedMe: true,
    reviewRequested: true,
  });

  instance.fetch.resolves({
    status: 200,
    text: "<html></html>",
  });

  await instance.fetchItems();

  const fetchedUrl = new URL(instance.fetch.firstCall.args[0]);
  const query = fetchedUrl.searchParams.get("q");

  Assert.ok(query.includes("author:@me"), "Should include author");
  Assert.ok(query.includes("assignee:@me"), "Should include assignee");
  Assert.ok(
    query.includes("review-requested:@me"),
    "Should include review-requested"
  );

  Assert.ok(query.includes(" OR "), "Should contain OR operators");
  sandbox.restore();
});

add_task(async function test_html_parsing_logic() {
  info("should parse HTML and return structured items");

  let sandbox = sinon.createSandbox();
  let instance = getGithubProviderForTest(sandbox);

  const mockHtml = `
    <html>
      <body>
        <div>
           <div class="IssueItem-module__defaultRepoContainer"><span>mozilla/zen</span><span>#101</span></div>
           <a class="IssueItem-module__authorCreatedLink">UserA</a>
           <div class="Title-module__container">Fix the login bug</div>
           <a data-testid="issue-pr-title-link" href="/issues/101"></a>
        </div>
        <div>
           <div class="IssueItem-module__defaultRepoContainer"><span>mozilla/zen</span><span>#102</span></div>
           <a class="IssueItem-module__authorCreatedLink">UserB</a>
           <div class="Title-module__container">Add dark mode</div>
           <a data-testid="issue-pr-title-link" href="/pull/102"></a>
        </div>
      </body>
    </html>
  `;

  instance.fetch.resolves({
    text: mockHtml,
    status: 200,
  });

  const items = await instance.fetchItems();

  Assert.equal(items.length, 2, "Should find 2 items");

  Assert.equal(items[0].title, "Fix the login bug");
  Assert.equal(items[0].subtitle, "UserA");
  Assert.equal(items[0].id, "mozilla/zen#101");
  Assert.equal(items[0].url, "https://github.com/issues/101");

  Assert.equal(items[1].title, "Add dark mode");
  Assert.equal(items[1].subtitle, "UserB");
  Assert.equal(items[1].id, "mozilla/zen#102");
  Assert.equal(items[1].url, "https://github.com/pull/102");

  sandbox.restore();
});

add_task(async function test_fetch_network_error() {
  info("should gracefully handle network exceptions");

  let sandbox = sinon.createSandbox();
  let instance = getGithubProviderForTest(sandbox);

  instance.fetch.rejects(new Error("Network down"));

  const errorId = await instance.fetchItems();
  Assert.equal(
    errorId,
    "zen-live-folder-failed-fetch",
    "Should return an error on failed fetch"
  );

  sandbox.restore();
});

add_task(async function test_no_filter_enabled_returns_error() {
  info(
    "should short-circuit and return the no-filter error when every option is off"
  );

  let sandbox = sinon.createSandbox();
  let instance = getGithubProviderForTest(sandbox, {
    type: "pull-requests",
    authorMe: false,
    assignedMe: false,
    reviewRequested: false,
  });

  const result = await instance.fetchItems();

  Assert.equal(
    result,
    "zen-live-folder-github-no-filter",
    "Should return the no-filter error id"
  );
  Assert.ok(
    instance.fetch.notCalled,
    "Should not issue a fetch when no filter is enabled"
  );

  sandbox.restore();
});

add_task(async function test_404_returns_no_auth() {
  info("should treat a 404 as a missing-auth signal");

  let sandbox = sinon.createSandbox();
  let instance = getGithubProviderForTest(sandbox, {
    type: "pull-requests",
    authorMe: true,
  });

  instance.fetch.resolves({ status: 404, text: "" });

  const result = await instance.fetchItems();

  Assert.equal(
    result,
    "zen-live-folder-github-no-auth",
    "Should return the no-auth error id"
  );

  sandbox.restore();
});

add_task(async function test_repo_excludes_emit_negative_repo_filters() {
  info("should add -repo:<repo> clauses for each excluded repository");

  let sandbox = sinon.createSandbox();
  let instance = getGithubProviderForTest(sandbox, {
    type: "pull-requests",
    authorMe: true,
    assignedMe: false,
    reviewRequested: false,
    repoExcludes: ["zen-browser/desktop", "foo/bar"],
  });

  instance.fetch.resolves({ status: 200, text: "<html></html>" });

  await instance.fetchItems();

  const fetchedUrl = new URL(instance.fetch.firstCall.args[0]);
  const query = fetchedUrl.searchParams.get("q");

  Assert.ok(
    query.includes("-repo:zen-browser/desktop"),
    "Should exclude zen-browser/desktop from the query"
  );
  Assert.ok(
    query.includes("-repo:foo/bar"),
    "Should exclude foo/bar from the query"
  );

  sandbox.restore();
});

add_task(async function test_pull_requests_json_api_parsing() {
  info("should parse the new PR dashboard JSON payload");

  let sandbox = sinon.createSandbox();
  let instance = getGithubProviderForTest(sandbox, {
    type: "pull-requests",
    authorMe: true,
  });

  const payload = JSON.stringify({
    payload: {
      pullsDashboardSurfaceContentRoute: {
        results: [
          {
            repoNameWithOwner: "zen-browser/desktop",
            number: 42,
            title: "Add live folders",
            author: { displayLogin: "alice" },
            permalink: "https://github.com/zen-browser/desktop/pull/42",
          },
          {
            repoNameWithOwner: "zen-browser/desktop",
            number: 43,
            title: "Fix bug",
            author: { displayLogin: "bob" },
            permalink: "https://github.com/zen-browser/desktop/pull/43",
          },
        ],
      },
    },
  });

  instance.fetch.resolves({ status: 200, text: payload });

  const items = await instance.fetchItems();

  Assert.equal(items.length, 2, "Should parse two PRs from the JSON payload");
  Assert.equal(items[0].id, "zen-browser/desktop#42");
  Assert.equal(items[0].title, "Add live folders");
  Assert.equal(items[0].subtitle, "alice");
  Assert.equal(items[0].url, "https://github.com/zen-browser/desktop/pull/42");
  Assert.equal(items[1].id, "zen-browser/desktop#43");
  Assert.ok(
    instance.state.isJsonApi,
    "Should mark the provider as using the JSON API"
  );

  sandbox.restore();
});

add_task(async function test_pull_requests_json_api_falls_back_to_html() {
  info(
    "should fall back to HTML parsing when an HTML response arrives unexpectedly"
  );

  let sandbox = sinon.createSandbox();
  let instance = getGithubProviderForTest(sandbox, {
    type: "pull-requests",
    authorMe: true,
  });

  // Simulate a previous fetch having locked the provider into JSON-API mode.
  instance.state.isJsonApi = true;

  instance.fetch.resolves({
    status: 200,
    text: "<html><body>not JSON</body></html>",
  });

  const result = await instance.fetchItems();

  Assert.equal(
    instance.state.isJsonApi,
    false,
    "Should clear isJsonApi after seeing a non-JSON response"
  );
  Assert.equal(
    result,
    "zen-live-folder-failed-fetch",
    "Should surface a fetch error so the user is prompted to retry"
  );

  sandbox.restore();
});
