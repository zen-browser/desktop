/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

ChromeUtils.defineESModuleGetters(this, {
  sinon: "resource://testing-common/Sinon.sys.mjs",
  nsGithubLiveFolderProvider: "resource:///modules/zen/GithubLiveFolder.sys.mjs",
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
  info("should construct the correct GitHub search URL based on default options");

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

  Assert.ok(fetchedUrl.href.startsWith("https://github.com/issues/assigned"));

  const query = searchParams.get("q");
  Assert.ok(query.includes("state:open"), "Should include state:open");
  Assert.ok(query.includes("is:pr"), "Should include is:PR");
  Assert.ok(query.includes("author:@me"), "Should include author:@me");
  Assert.ok(!query.includes("assignee:@me"), "Should NOT include assignee:@me");
  Assert.ok(!query.includes("review-requested:@me"), "Should NOT include review-requested");

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
  Assert.ok(query.includes("review-requested:@me"), "Should include review-requested");

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
           <a data-testid="issue-pr-title-link" href="issues/101"></a>
        </div>
        <div>
           <div class="IssueItem-module__defaultRepoContainer"><span>mozilla/zen</span><span>#102</span></div>
           <a class="IssueItem-module__authorCreatedLink">UserB</a>
           <div class="Title-module__container">Add dark mode</div>
           <a data-testid="issue-pr-title-link" href="pull/102"></a>
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
  Assert.equal(errorId, "zen-live-folder-failed-fetch", "Should return an error on failed fetch");

  sandbox.restore();
});
