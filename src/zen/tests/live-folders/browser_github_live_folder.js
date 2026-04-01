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
    host: customOptions.host,
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

  Assert.ok(
    fetchedUrl.href.startsWith("https://github.com/pulls"),
    "PR type should use /pulls endpoint"
  );

  const query = searchParams.get("q");
  Assert.ok(query.includes("state:open"), "Should include state:open");
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

add_task(async function test_ghe_without_token_returns_auth_error() {
  info("GHE instance without token should return auth error immediately");

  let sandbox = sinon.createSandbox();

  let instance = getGithubProviderForTest(sandbox, {
    authorMe: true,
    assignedMe: false,
    reviewRequested: false,
    type: "pull-requests",
    host: "https://github.corp.com",
  });

  instance.fetch.resolves({
    status: 200,
    text: "<html></html>",
  });

  const result = await instance.fetchItems();

  Assert.equal(
    result,
    "zen-live-folder-github-no-auth",
    "GHE without token should return auth error"
  );
  Assert.ok(
    !instance.fetch.called,
    "Should not attempt to fetch without a token for GHE"
  );

  sandbox.restore();
});

add_task(async function test_custom_host_state_construction() {
  info("should construct state correctly with custom host");

  let sandbox = sinon.createSandbox();

  // PR type
  let prInstance = getGithubProviderForTest(sandbox, {
    type: "pull-requests",
    host: "https://github.corp.com",
  });
  Assert.equal(
    prInstance.state.host,
    "https://github.corp.com",
    "Custom host should be preserved"
  );
  Assert.ok(
    prInstance.state.url.startsWith("https://github.corp.com/pulls"),
    "URL should use custom host for PRs"
  );

  // Issues type
  let issueInstance = getGithubProviderForTest(sandbox, {
    type: "issues",
    host: "https://github.corp.com",
  });
  Assert.ok(
    issueInstance.state.url.startsWith(
      "https://github.corp.com/issues/assigned"
    ),
    "URL should use custom host for issues"
  );

  sandbox.restore();
});

add_task(async function test_non_2xx_triggers_auth_error() {
  info("should treat non-2xx responses as auth errors for github.com");

  let sandbox = sinon.createSandbox();
  let instance = getGithubProviderForTest(sandbox, {
    type: "pull-requests",
  });

  instance.fetch.resolves({
    status: 403,
    text: "<html>Forbidden</html>",
  });

  const errorId = await instance.fetchItems();
  Assert.equal(
    errorId,
    "zen-live-folder-github-no-auth",
    "Should return auth error for 403 status"
  );

  sandbox.restore();
});

add_task(async function test_empty_results_triggers_auth_error() {
  info("should treat empty results as auth error (login page returned)");

  let sandbox = sinon.createSandbox();
  let instance = getGithubProviderForTest(sandbox);

  instance.fetch.resolves({
    status: 200,
    text: "<html><body>Please log in</body></html>",
  });

  const errorId = await instance.fetchItems();
  Assert.equal(
    errorId,
    "zen-live-folder-github-no-auth",
    "Should return auth error when 200 but no items parsed"
  );

  sandbox.restore();
});

add_task(async function test_state_host_defaults() {
  info("should default host to github.com when not specified");

  let sandbox = sinon.createSandbox();

  let instance = getGithubProviderForTest(sandbox, {
    type: "pull-requests",
  });
  Assert.equal(
    instance.state.host,
    "https://github.com",
    "Default host should be github.com"
  );
  Assert.ok(
    instance.state.url.startsWith("https://github.com/pulls"),
    "URL should use github.com for PRs"
  );

  let gheInstance = getGithubProviderForTest(sandbox, {
    type: "issues",
    host: "https://github.corp.com",
  });
  Assert.equal(
    gheInstance.state.host,
    "https://github.corp.com",
    "Custom host should be preserved"
  );
  Assert.ok(
    gheInstance.state.url.startsWith("https://github.corp.com/issues/assigned"),
    "URL should use custom host for issues"
  );

  sandbox.restore();
});
