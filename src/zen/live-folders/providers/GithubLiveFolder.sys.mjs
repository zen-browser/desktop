// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { nsZenLiveFolderProvider } from "resource:///modules/zen/ZenLiveFolder.sys.mjs";

export class nsGithubLiveFolderProvider extends nsZenLiveFolderProvider {
  static type = "github";

  constructor({ id, state, manager }) {
    super({ id, state, manager });

    this.state.type = state.type;
    this.state.url =
      this.state.type === "pull-requests"
        ? "https://github.com/pulls"
        : "https://github.com/issues/assigned";

    this.state.options = state.options ?? {};
    this.state.repos = new Set(state.repos ?? []);
    this.state.options.repoExcludes = new Set(state.options.repoExcludes ?? []);
  }

  async fetchItems() {
    try {
      const hasAnyFilterEnabled =
        (this.state.options.authorMe ?? false) ||
        (this.state.options.assignedMe ?? true) ||
        (this.state.options.reviewRequested ?? false);

      if (!hasAnyFilterEnabled) {
        return "zen-live-folder-github-no-filter";
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
        // Assume no auth
        if (status === 404) {
          return "zen-live-folder-github-no-auth";
        }

        if (items) {
          items.forEach(item => combinedItems.set(item.id, item));
        }

        if (activeRepos) {
          activeRepos.forEach(repo => combinedActiveRepos.add(repo));
        }
      }

      this.state.repos = combinedActiveRepos;
      return Array.from(combinedItems.values());
    } catch (error) {
      console.error("Error fetching or parsing GitHub issues:", error);
      return "zen-live-folder-failed-fetch";
    }
  }

  async parsePullRequests(url) {
    const { text, status } = await this.fetch(url);

    try {
      const document = new DOMParser().parseFromString(text, "text/html");
      const issues = document.querySelectorAll("div[id^=issue_]");
      const items = [];
      const activeRepos = [];

      if (issues.length) {
        const authors = document.querySelectorAll(".opened-by a");
        const titles = document.querySelectorAll("a[id^=issue_]");

        for (let i = 0; i < issues.length; i++) {
          const author = authors[i].textContent;
          const title = titles[i].textContent;

          const repo = titles[i].previousElementSibling.textContent.trim();
          if (repo) {
            activeRepos.push(repo);
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
    } catch (err) {
      console.error("Failed to parse Github pull requests", err);
      return {
        status,
      };
    }
  }

  async parseIssues(url) {
    const { text, status } = await this.fetch(url);

    try {
      const document = new DOMParser().parseFromString(text, "text/html");
      const issues = document.querySelectorAll(
        "div[class^=IssueItem-module__defaultRepoContainer]"
      );
      const items = [];
      const activeRepos = [];

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
            activeRepos.push(repo);
          }

          const numberMatch = rawNumber?.textContent?.match(/[0-9]+/);
          const number = numberMatch?.[0] ?? "";

          items.push({
            title,
            subtitle: author,
            icon: "chrome://browser/content/zen-images/favicons/github.svg",
            url: "https://github.com" + issueUrl,
            id: `${repo}#${number}`,
          });
        }
      }

      return {
        status,

        items,
        activeRepos,
      };
    } catch (err) {
      console.error("Failed to parse Github Issues", err);
      return {
        status,
      };
    }
  }

  #buildSearchOptions() {
    const baseQuery = [
      this.state.type === "pull-requests" ? "is:pr" : "is:issue",
      "state:open",
      "sort:updated-desc",
    ];

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
    if (this.state.type === "pull-requests") {
      for (const query of queries) {
        searchParams.push(`${baseQuery.join(" ")} ${query}`);
      }

      return searchParams;
    }

    // type: issues
    return [`${baseQuery.join(" ")} ${queries.join(" OR ")}`];
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
      { type: "separator" },
      {
        l10nId: "zen-live-folder-github-option-repo-filter",
        key: "repoExclude",
        options: repoOptions,
        // 1 repo + separator + note = 3 options, so if we have less than 4 options it means we don't have any repo to exclude
        disabled: repoOptions.length < 4,
      },
    ];
  }

  onOptionTrigger(option) {
    super.onOptionTrigger(option);

    const key = option.getAttribute("option-key");
    const checked = option.hasAttribute("checked");
    if (!this.options.some(x => x.key === key)) {
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
        const tab = this.manager.window.gBrowser.addTrustedTab(
          "https://github.com/login"
        );
        this.manager.window.gBrowser.selectedTab = tab;
        break;
      }
      case "zen-live-folder-github-no-filter": {
        this.refresh();
        break;
      }
    }
  }

  serialize() {
    return {
      state: {
        ...this.state,
        repos: Array.from(this.state.repos),
        options: {
          ...this.state.options,
          repoExcludes: Array.from(this.state.options.repoExcludes),
        },
      },
    };
  }
}
