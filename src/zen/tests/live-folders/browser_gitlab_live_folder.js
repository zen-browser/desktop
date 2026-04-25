/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

ChromeUtils.defineESModuleGetters(this, {
  sinon: "resource://testing-common/Sinon.sys.mjs",
  nsGitlabLiveFolderProvider:
    "resource:///modules/zen/GitlabLiveFolder.sys.mjs",
  GitlabAuth: "resource:///modules/zen/GitlabAuth.sys.mjs",
});

function getGitlabProviderForTest(sandbox, customOptions = {}) {
  const {
    type = "merge-requests",
    host = "gitlab.com",
    ...rest
  } = customOptions;
  const defaultOptions = {
    authorMe: false,
    assignedMe: true,
    reviewRequested: false,
    ...rest,
  };

  const mockManager = {
    saveState: sandbox.spy(),
  };

  const initialState = {
    interval: 60,
    lastFetched: 0,
    type,
    host,
    options: defaultOptions,
  };

  const instance = new nsGitlabLiveFolderProvider({
    id: "test-gitlab-folder",
    state: initialState,
    manager: mockManager,
  });

  sandbox.stub(instance, "fetch");
  sandbox.stub(GitlabAuth, "getToken").resolves(null);
  return instance;
}

add_task(async function test_fetch_url_assigned_to_me_default() {
  info(
    "should query the merge_requests endpoint with scope=assigned_to_me by default"
  );

  const sandbox = sinon.createSandbox();
  const instance = getGitlabProviderForTest(sandbox);

  instance.fetch.resolves({ status: 200, text: "[]" });
  await instance.fetchItems();

  Assert.ok(instance.fetch.calledOnce, "Fetch should be called once");
  const fetchedUrl = new URL(instance.fetch.firstCall.args[0]);
  Assert.equal(fetchedUrl.host, "gitlab.com");
  Assert.equal(fetchedUrl.pathname, "/api/v4/merge_requests");
  Assert.equal(fetchedUrl.searchParams.get("scope"), "assigned_to_me");
  Assert.equal(fetchedUrl.searchParams.get("state"), "opened");
  Assert.equal(fetchedUrl.searchParams.get("per_page"), "50");

  sandbox.restore();
});

add_task(async function test_fetch_url_review_requested() {
  info(
    "should resolve the user id and issue a reviewer_id+scope=all query when reviewRequested is enabled"
  );

  const sandbox = sinon.createSandbox();
  const instance = getGitlabProviderForTest(sandbox, {
    assignedMe: false,
    reviewRequested: true,
  });

  instance.fetch.onFirstCall().resolves({
    status: 200,
    text: JSON.stringify({ id: 4242, username: "alice" }),
  });
  instance.fetch.onSecondCall().resolves({ status: 200, text: "[]" });

  await instance.fetchItems();

  Assert.equal(
    instance.fetch.callCount,
    2,
    "Should resolve the user then query MRs"
  );
  const userUrl = new URL(instance.fetch.firstCall.args[0]);
  Assert.equal(userUrl.pathname, "/api/v4/user");

  const url = new URL(instance.fetch.secondCall.args[0]);
  Assert.equal(url.searchParams.get("reviewer_id"), "4242");
  Assert.equal(url.searchParams.get("scope"), "all");
  Assert.equal(url.searchParams.get("reviewer_username"), null);

  sandbox.restore();
});

add_task(async function test_fetch_url_self_hosted_host() {
  info("should respect a custom self-hosted host");

  const sandbox = sinon.createSandbox();
  const instance = getGitlabProviderForTest(sandbox, {
    host: "gitlab.example.com",
  });

  instance.fetch.resolves({ status: 200, text: "[]" });
  await instance.fetchItems();

  const url = new URL(instance.fetch.firstCall.args[0]);
  Assert.equal(url.host, "gitlab.example.com");
  Assert.ok(url.pathname.startsWith("/api/v4/"));

  sandbox.restore();
});

add_task(async function test_fetch_uses_issues_endpoint_when_type_is_issues() {
  info("should hit /api/v4/issues when state.type is 'issues'");

  const sandbox = sinon.createSandbox();
  const instance = getGitlabProviderForTest(sandbox, { type: "issues" });

  instance.fetch.resolves({ status: 200, text: "[]" });
  await instance.fetchItems();

  const url = new URL(instance.fetch.firstCall.args[0]);
  Assert.equal(url.pathname, "/api/v4/issues");

  sandbox.restore();
});

add_task(async function test_pat_header_injected_when_token_present() {
  info(
    "should inject PRIVATE-TOKEN header when GitlabAuth returns a token for the host"
  );

  const sandbox = sinon.createSandbox();
  const instance = getGitlabProviderForTest(sandbox);
  GitlabAuth.getToken.restore();
  sandbox.stub(GitlabAuth, "getToken").resolves("glpat-deadbeef");

  instance.fetch.resolves({ status: 200, text: "[]" });
  await instance.fetchItems();

  const opts = instance.fetch.firstCall.args[1];
  Assert.ok(opts && opts.headers, "headers should be passed to fetch");
  Assert.equal(opts.headers["PRIVATE-TOKEN"], "glpat-deadbeef");
  Assert.equal(opts.headers.Accept, "application/json");

  sandbox.restore();
});

add_task(async function test_pat_header_omitted_when_no_token() {
  info("should not send PRIVATE-TOKEN header when there is no stored token");

  const sandbox = sinon.createSandbox();
  const instance = getGitlabProviderForTest(sandbox);

  instance.fetch.resolves({ status: 200, text: "[]" });
  await instance.fetchItems();

  const opts = instance.fetch.firstCall.args[1];
  Assert.ok(opts && opts.headers, "headers should be passed to fetch");
  Assert.ok(
    !("PRIVATE-TOKEN" in opts.headers),
    "PRIVATE-TOKEN must be absent when no token is stored"
  );

  sandbox.restore();
});

add_task(async function test_json_parsing_into_items() {
  info("should parse the JSON payload into FolderItem-shaped entries");

  const sandbox = sinon.createSandbox();
  const instance = getGitlabProviderForTest(sandbox);

  const payload = JSON.stringify([
    {
      iid: 42,
      title: "Improve cache eviction",
      web_url: "https://gitlab.com/group/project/-/merge_requests/42",
      author: { username: "alice" },
      references: { full: "group/project!42" },
    },
    {
      iid: 7,
      title: "Fix flaky test",
      web_url: "https://gitlab.com/group/other/-/merge_requests/7",
      author: { username: "bob" },
      references: { full: "group/other!7" },
    },
  ]);

  instance.fetch.resolves({ status: 200, text: payload });
  const items = await instance.fetchItems();

  Assert.ok(
    Array.isArray(items),
    "fetchItems should return an array on success"
  );
  Assert.equal(items.length, 2);
  Assert.equal(items[0].id, "group/project!42");
  Assert.equal(items[0].title, "Improve cache eviction");
  Assert.equal(items[0].subtitle, "alice");
  Assert.equal(
    items[0].url,
    "https://gitlab.com/group/project/-/merge_requests/42"
  );

  sandbox.restore();
});

add_task(async function test_auth_error_status() {
  info("should return the GitLab no-auth error id on 401/403");

  for (const status of [401, 403]) {
    const sandbox = sinon.createSandbox();
    const instance = getGitlabProviderForTest(sandbox);
    instance.fetch.resolves({ status, text: "" });

    const result = await instance.fetchItems();
    Assert.equal(result, "zen-live-folder-gitlab-no-auth");

    sandbox.restore();
  }
});

add_task(async function test_no_filter_enabled_returns_no_filter_error() {
  info(
    "should short-circuit with no-filter error when every scope option is off"
  );

  const sandbox = sinon.createSandbox();
  const instance = getGitlabProviderForTest(sandbox, {
    authorMe: false,
    assignedMe: false,
    reviewRequested: false,
  });

  const result = await instance.fetchItems();
  Assert.equal(result, "zen-live-folder-gitlab-no-filter");
  Assert.ok(instance.fetch.notCalled, "Fetch must not be called");

  sandbox.restore();
});

add_task(async function test_network_error_returns_failed_fetch() {
  info("should gracefully turn network errors into the failed-fetch id");

  const sandbox = sinon.createSandbox();
  const instance = getGitlabProviderForTest(sandbox);
  instance.fetch.rejects(new Error("Network down"));

  const result = await instance.fetchItems();
  Assert.equal(result, "zen-live-folder-failed-fetch");

  sandbox.restore();
});
