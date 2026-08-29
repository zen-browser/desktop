// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { nsZenLiveFolderProvider } from "resource:///modules/zen/ZenLiveFolder.sys.mjs";
import { GithubTokenManager } from "resource:///modules/zen/GithubAuth.sys.mjs";

const lazy = {};
ChromeUtils.defineLazyGetter(
  lazy,
  "l10n",
  () => new Localization(["browser/zen-live-folders.ftl"])
);

export class nsGithubLiveFolderProvider extends nsZenLiveFolderProvider {
  static type = "github";

  constructor({ id, state, manager }) {
    super({ id, state, manager });

    this.state.type = state.type;
    this.state.host = state.host || "https://github.com";
    this.state.url =
      this.state.type === "pull-requests"
        ? new URL("/pulls", this.state.host).href
        : new URL("/issues/assigned", this.state.host).href;

    this.state.options = state.options ?? {};
    this.state.repos = new Set(state.repos ?? []);
    this.state.options.repoExcludes = new Set(state.options.repoExcludes ?? []);
    this.state._hasToken = false;
  }

  get #isGitHubEnterprise() {
    return new URL(this.state.host).hostname !== "github.com";
  }

  get #hasAnyFilterEnabled() {
    return (
      (this.state.options.authorMe ?? false) ||
      (this.state.options.assignedMe ?? true) ||
      (this.state.options.reviewRequested ?? false)
    );
  }

  async fetchItems() {
    try {
      const token = await GithubTokenManager.getToken(this.state.host);
      this.state._hasToken = !!token;
      if (token) {
        return this.#fetchItemsViaApi(token);
      }

      if (!this.#hasAnyFilterEnabled) {
        return "zen-live-folder-github-no-filter";
      }

      if (
        this.state.type === "pull-requests" &&
        typeof this.state.isJsonApi !== "boolean" &&
        !Services.prefs.getBoolPref(
          "zen.live-folders.github.skip-new-pr-ui-check",
          false
        )
      ) {
        const { text, status } = await this.fetch(this.state.url, {
          headers: {
            Accept: "application/json,text/html",
          },
        });
        if (status === 404) {
          return "zen-live-folder-github-no-auth";
        }
        try {
          JSON.parse(text);
          this.state.isJsonApi = true;
        } catch {
          this.state.isJsonApi = false;
        }
      }

      const queries = this.#buildSearchOptions();
      const requests = await Promise.all(
        queries.map(query => {
          const url = new URL(this.state.url);
          url.searchParams.set("q", query);

          if (this.state.type === "pull-requests") {
            return this.parsePullRequests(url.href);
          }

          return this.parseIssues(url.href);
        })
      );

      const combinedItems = new Map();
      const combinedActiveRepos = new Set();

      for (const { status, items, activeRepos } of requests) {
        // Any non-2xx status likely means not authenticated
        if (status && (status < 200 || status >= 300)) {
          return "zen-live-folder-github-no-auth";
        }

        if (items) {
          for (const item of items) {
            combinedItems.set(item.id, item);
          }
        }

        if (activeRepos) {
          for (const repo of activeRepos) {
            combinedActiveRepos.add(repo);
          }
        }
      }

      this.state.repos = combinedActiveRepos;

      // A 200 with no items likely means we got a login page instead of real content
      if (combinedItems.size === 0) {
        return "zen-live-folder-github-no-auth";
      }

      return Array.from(combinedItems.values());
    } catch (error) {
      console.error("Error fetching or parsing GitHub issues:", error);
      return "zen-live-folder-failed-fetch";
    }
  }

  async #fetchItemsViaApi(token) {
    try {
      if (!this.#hasAnyFilterEnabled) {
        return "zen-live-folder-github-no-filter";
      }

      const queries = this.#buildSearchOptions();
      const apiBase = this.#getApiBaseUrl();

      const combinedItems = new Map();
      const combinedActiveRepos = new Set();

      const results = await Promise.allSettled(
        queries.map(async query => {
          const url = new URL(`${apiBase}/search/issues`);
          url.searchParams.set("q", query);
          url.searchParams.set("per_page", "50");

          return this.fetch(url.href, {
            headers: {
              Authorization: `token ${token}`,
              Accept: "application/vnd.github.v3+json",
            },
          });
        })
      );

      for (const result of results) {
        if (result.status !== "fulfilled") {
          continue;
        }

        const { text, status } = result.value;

        if (status === 401 || status === 403) {
          await GithubTokenManager.removeToken(this.state.host);
          this.state._hasToken = false;
          return "zen-live-folder-github-token-expired";
        }

        if (status && (status < 200 || status >= 300)) {
          continue;
        }

        try {
          const data = JSON.parse(text);
          if (data.items) {
            for (const item of data.items) {
              const repoFullName = item.repository_url
                ? item.repository_url.replace(/.*\/repos\//, "")
                : "";
              const id = `${repoFullName}#${item.number}`;

              if (repoFullName) {
                combinedActiveRepos.add(repoFullName);
              }

              combinedItems.set(id, {
                title: item.title,
                subtitle: item.user?.login || "",
                icon: "chrome://browser/content/zen-images/favicons/github.svg",
                url: item.html_url,
                id,
              });
            }
          }
        } catch {
          // JSON parse failure
        }
      }

      this.state.repos = combinedActiveRepos;
      return Array.from(combinedItems.values());
    } catch (error) {
      console.error("Error fetching GitHub API:", error);
      return "zen-live-folder-failed-fetch";
    }
  }

  #getApiBaseUrl() {
    const hostUrl = new URL(this.state.host);
    if (hostUrl.hostname === "github.com") {
      return "https://api.github.com";
    }
    // GitHub Enterprise Server uses /api/v3 prefix
    return `${this.state.host}/api/v3`;
  }

  async parsePullRequests(url) {
    const { text, status } = await this.fetch(url, {
      headers: {
        Accept: "application/json,text/html",
      },
    });

    if (status !== 200) {
      return { status };
    }

    let parsedJson = null;
    try {
      parsedJson = JSON.parse(text);
      this.state.isJsonApi = true;
    } catch {
      if (this.state.isJsonApi) {
        this.state.isJsonApi = false;
        // throw to indicate user to re-try (Url may contain invalid params for non-json /pulls)
        throw new Error("Unexpected content type");
      }
    }

    if (parsedJson) {
      const results =
        parsedJson.payload.pullsDashboardSurfaceContentRoute.results;

      const items = [];
      const activeRepos = new Set();

      for (const pr of results) {
        activeRepos.add(pr.repoNameWithOwner);
        items.push({
          id: `${pr.repoNameWithOwner}#${pr.number}`,
          title: pr.title,
          subtitle: pr.author.displayLogin,
          icon: "chrome://browser/content/zen-images/favicons/github.svg",
          url: pr.permalink,
        });
      }

      return {
        status,

        items,
        activeRepos,
      };
    }
    const document = new DOMParser().parseFromString(text, "text/html");
    const issues = document.querySelectorAll("div[id^=issue_]");

    const items = [];
    const activeRepos = new Set();

    if (issues.length) {
      const authors = document.querySelectorAll(".opened-by a");
      const titles = document.querySelectorAll("a[id^=issue_]");

      for (let i = 0; i < issues.length; i++) {
        const author = authors[i].textContent;
        const title = titles[i].textContent;

        const repo = titles[i].previousElementSibling.textContent.trim();
        if (repo) {
          activeRepos.add(repo);
        }

        const idMatch = authors[i].parentElement.textContent
          .match(/#[0-9]+/)
          .shift();

        items.push({
          title,
          subtitle: author,
          icon: "chrome://browser/content/zen-images/favicons/github.svg",
          url: new URL(titles[i].href, this.state.url),
          id: `${repo}${idMatch}`,
        });
      }
    }

    return {
      status,

      items,
      activeRepos,
    };
  }

  async parseIssues(url) {
    const { text, status } = await this.fetch(url);

    if (status !== 200) {
      return { status };
    }

    const document = new DOMParser().parseFromString(text, "text/html");
    const issues = document.querySelectorAll(
      "div[class^=IssueItem-module__defaultRepoContainer]"
    );
    const items = [];
    const activeRepos = new Set();

    if (issues.length) {
      const authors = document.querySelectorAll(
        "a[class^=IssueItem-module__authorCreatedLink]"
      );
      const titles = document.querySelectorAll(
        "div[class^=Title-module__container]"
      );
      const links = document.querySelectorAll(
        '[data-testid="issue-pr-title-link"]'
      );

      for (let i = 0; i < issues.length; i++) {
        const [rawRepo, rawNumber] = issues[i].childNodes;
        const author = authors[i]?.textContent;
        const title = titles[i]?.textContent;
        const issueUrl = links[i]?.href;

        const repo = rawRepo.textContent?.trim();
        if (repo) {
          activeRepos.add(repo);
        }

        const numberMatch = rawNumber?.textContent?.match(/[0-9]+/);
        const number = numberMatch?.[0] ?? "";

        items.push({
          title,
          subtitle: author,
          icon: "chrome://browser/content/zen-images/favicons/github.svg",
          url: new URL(issueUrl, this.state.host).href,
          id: `${repo}#${number}`,
        });
      }
    }

    return {
      status,

      items,
      activeRepos,
    };
  }

  #buildSearchOptions() {
    const baseQuery = [
      this.state.type === "pull-requests" ? "is:pr" : "is:issue",
      "is:open",
      "sort:updated-desc",
    ];

    if (
      this.state.type === "pull-requests" &&
      !(this.state.options.includeDrafts ?? true)
    ) {
      baseQuery.push("draft:false");
    }

    const options = [
      {
        value: "author:@me",
        enabled: this.state.options.authorMe ?? false,
      },
      {
        value: "assignee:@me",
        enabled: this.state.options.assignedMe ?? true,
      },
      {
        value: "review-requested:@me",
        enabled: this.state.options.reviewRequested ?? false,
      },
    ];

    const excluded = this.state.options.repoExcludes;
    for (const repo of excluded) {
      if (repo && repo.trim()) {
        baseQuery.push(`-repo:${repo.trim()}`);
      }
    }

    const queries = [];
    for (const option of options) {
      if (option.enabled) {
        queries.push(option.value);
      }
    }

    const searchParams = [];
    if (this.state.type === "pull-requests" && !this.state.isJsonApi) {
      for (const query of queries) {
        searchParams.push(`${baseQuery.join(" ")} ${query}`);
      }

      return searchParams;
    }

    // type: issues or pull requests json api
    return [`${baseQuery.join(" ")} (${queries.join(" OR ")})`];
  }

  get options() {
    const excluded = this.state.options.repoExcludes;
    const repoOptions = Array.from(this.state.repos.union(excluded))
      .sort((a, b) => a.localeCompare(b))
      .map(repo => ({
        l10nId: "zen-live-folder-github-option-repo",
        l10nArgs: { repo },

        key: "repoExclude",
        value: repo,

        type: "checkbox",
        checked: !excluded.has(repo),
      }));

    if (repoOptions.length) {
      repoOptions.push({ type: "separator" });
    }

    repoOptions.push({
      l10nId: "zen-live-folder-github-option-repo-list-note",
      disabled: true,
    });

    return [
      {
        l10nId: "zen-live-folder-github-option-author-self",
        key: "authorMe",
        checked: this.state.options.authorMe ?? false,
      },
      {
        l10nId: "zen-live-folder-github-option-assigned-self",
        key: "assignedMe",
        checked: this.state.options.assignedMe ?? true,
      },
      {
        l10nId: "zen-live-folder-github-option-review-requested",
        key: "reviewRequested",
        checked: this.state.options.reviewRequested ?? false,
        hidden: this.state.type === "issues",
      },
      {
        l10nId: "zen-live-folder-github-option-include-drafts",
        key: "includeDrafts",
        checked: this.state.options.includeDrafts ?? true,
        hidden: this.state.type !== "pull-requests",
      },
      { type: "separator" },
      {
        l10nId: "zen-live-folder-github-option-repo-filter",
        key: "repoExclude",
        options: repoOptions,
        // 1 repo + separator + note = 3 options, so if we have less than 4 options it means we don't have any repo to exclude
        disabled: repoOptions.length < 4,
      },
      { type: "separator" },
      {
        l10nId: "zen-live-folder-github-option-instance",
        l10nArgs: { host: new URL(this.state.host).hostname },
        key: "githubInstance",
      },
      {
        l10nId: "zen-live-folder-github-option-set-token",
        key: "setToken",
        hidden: this.state._hasToken === true,
      },
      {
        l10nId: "zen-live-folder-github-option-remove-token",
        key: "removeToken",
        hidden: this.state._hasToken !== true,
      },
    ];
  }

  async onOptionTrigger(option) {
    super.onOptionTrigger(option);

    const key = option.getAttribute("option-key");
    const checked = option.hasAttribute("checked");
    if (!this.options.some(x => x.key === key)) {
      return;
    }

    if (key === "setToken") {
      const success = await GithubTokenManager.promptForToken(
        this.manager.window,
        this.state.host
      );
      if (success) {
        this.state._hasToken = true;
        this.refresh();
      }
      return;
    }

    if (key === "removeToken") {
      await GithubTokenManager.removeToken(this.state.host);
      this.state._hasToken = false;
      this.refresh();
      return;
    }

    if (key === "githubInstance") {
      const host = await nsGithubLiveFolderProvider.promptForHost(
        this.manager.window,
        this.state.host
      );
      if (host && host !== this.state.host) {
        this.state.host = host;
        const path =
          this.state.type === "pull-requests" ? "/pulls" : "/issues/assigned";
        this.state.url = new URL(path, host).href;

        // For GHE hosts, open the PAT creation page
        if (this.#isGitHubEnterprise) {
          this.#openPatCreationPage(host);
        }

        this.refresh();
        this.requestSave();
      }
      return;
    }

    if (key === "repoExclude") {
      const repo = option.getAttribute("option-value");
      if (!repo) {
        return;
      }

      const excluded = this.state.options.repoExcludes;
      if (checked) {
        excluded.delete(repo);
      } else {
        excluded.add(repo);
      }

      this.state.options.repoExcludes = excluded;
    } else {
      this.state.options[key] = checked;
    }

    this.refresh();
    this.requestSave();
  }

  async onActionButtonClick(errorId) {
    super.onActionButtonClick(errorId);

    switch (errorId) {
      case "zen-live-folder-github-no-auth": {
        if (this.#isGitHubEnterprise) {
          // For GHE instances, open the PAT creation page
          this.#openPatCreationPage(this.state.host);
        } else {
          // For github.com, open the login page
          const tab = this.manager.window.gBrowser.addTrustedTab(
            new URL("/login", this.state.host).href
          );
          this.manager.window.gBrowser.selectedTab = tab;
        }
        break;
      }
      case "zen-live-folder-github-no-filter": {
        this.refresh();
        break;
      }
      case "zen-live-folder-github-token-expired": {
        this.#openPatCreationPage(this.state.host);
        break;
      }
    }
  }

  #openPatCreationPage(host) {
    const tokenUrl = new URL("/settings/tokens/new", host);
    tokenUrl.searchParams.set("scopes", "repo");
    tokenUrl.searchParams.set("description", "Zen Browser Live Folders");

    const tab = this.manager.window.gBrowser.addTrustedTab(tokenUrl.href);
    this.manager.window.gBrowser.selectedTab = tab;
  }

  static async promptForHost(window, initialUrl = "https://github.com") {
    const input = { value: initialUrl };
    const [prompt] = await lazy.l10n.formatValues([
      "zen-live-folder-github-prompt-instance",
    ]);
    const promptOk = Services.prompt.prompt(
      window,
      prompt,
      null,
      input,
      null,
      { value: null }
    );

    if (!promptOk) {
      return null;
    }

    try {
      const raw = (input.value ?? "").trim();
      const parsed = new URL(raw);
      if (parsed.protocol !== "https:") {
        throw new Error();
      }
      return parsed.origin;
    } catch {
      window.gZenUIManager.showToast(
        "zen-live-folder-github-invalid-url-title",
        {
          descriptionId: "zen-live-folder-github-invalid-url-description",
          timeout: 6000,
        }
      );
    }

    return null;
  }

  serialize() {
    const { _hasToken, ...serializableState } = this.state;
    return {
      state: {
        ...serializableState,
        repos: Array.from(this.state.repos),
        options: {
          ...this.state.options,
          repoExcludes: Array.from(this.state.options.repoExcludes),
        },
      },
    };
  }
}
