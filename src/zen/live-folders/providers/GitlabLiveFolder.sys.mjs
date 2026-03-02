// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { nsZenLiveFolderProvider } from "resource:///modules/zen/ZenLiveFolder.sys.mjs";

export class nsGitlabLiveFolderProvider extends nsZenLiveFolderProvider {
  static type = "gitlab";
  #mergeRequestsQuery = `query fetchAllMergeRequests(
    $state: MergeRequestState = opened
    $perPage: Int!
    $sort: MergeRequestSort = UPDATED_DESC
    $includeAssigned: Boolean!
    $includeReviewRequested: Boolean!
    $includeAuthored: Boolean!
  ) {
    currentUser {
      reviewRequests: reviewRequestedMergeRequests(state: $state, first: $perPage, sort: $sort) @include(if: $includeReviewRequested) {
        nodes { title webUrl project { fullPath } author { username } }
      }
      assignedRequests: assignedMergeRequests(state: $state, first: $perPage, sort: $sort) @include(if: $includeAssigned) {
        nodes { title webUrl project { fullPath }  author { username } }
      }
      authoredRequests: authoredMergeRequests(includeAssigned: true, state: $state, first: $perPage, sort: $sort) @include(if: $includeAuthored) {
        nodes { title webUrl project { fullPath } author { username } }
      }
    }
  }`;

  #issuesQuery = `query fetchIssues(
    $perPage: Int!
    $authorUsername: String
    $assigneeUsernames: [String!]
    $includeAssigned: Boolean!
    $includeAuthored: Boolean!
  ) {
    authored: issues(
      state: opened
      sort: UPDATED_DESC
      first: $perPage
      authorUsername: $authorUsername
    ) @include(if: $includeAuthored) {
      nodes {
        title
        webUrl
        webPath
        reference(full: true)
        author { username }
      }
    }

    assigned: issues(
      state: opened
      sort: UPDATED_DESC
      first: $perPage
      assigneeUsernames: $assigneeUsernames
    ) @include(if: $includeAssigned) {
      nodes {
        title
        webUrl
        webPath
        reference(full: true)
        author { username }
      }
    }
  }`;

  constructor({ id, state, manager }) {
    super({ id, state, manager });

    this.state.url = "https://gitlab.com/api/graphql";
    this.state.type = "issues";

    this.state.projects = new Set(state.projects ?? []);

    this.state.options = state.options ?? {};
    this.state.options.authorMe ??= false;
    this.state.options.assignedMe ??= true;
    this.state.options.reviewRequested ??= false;
    this.state.options.projectExcludes = new Set(state.options.projectExcludes ?? []);

    this.fetchUsername();
  }

  async fetchUsername() {
    const { text } = await this.fetch(this.state.url, {
      method: "POST",
      body: JSON.stringify({
        query: "query currentUser { currentUser { username }}",
      }),
    });

    const { data } = JSON.parse(text);
    if (data.currentUser) {
      this.state.username = data.currentUser.username;
    }
  }

  async fetchItems() {
    try {
      if (this.state.type === "issues") {
        return this.#fetchIssues();
      }

      return this.#fetchMergeRequests();
    } catch (err) {
      return "zen-live-folder-failed-fetch";
    }
  }

  async #fetchMergeRequests() {
    const hasAnyFilterEnabled =
      this.state.options.authorMe ||
      this.state.options.assignedMe ||
      this.state.options.reviewRequested;

    if (!hasAnyFilterEnabled) {
      return "zen-live-folder-github-no-filter";
    }

    const { text } = await this.fetch(this.state.url, {
      method: "POST",
      body: JSON.stringify({
        query: this.#mergeRequestsQuery,
        variables: {
          state: "opened",
          perPage: 30,
          includeAssigned: this.state.options.assignedMe,
          includeReviewRequested: this.state.options.reviewRequested,
          includeAuthored: this.state.options.authorMe,
        },
      }),
    });

    const { data } = JSON.parse(text);
    if (!data.currentUser) {
      return "zen-live-folder-github-no-auth";
    }

    const projects = new Set();

    const assignedNodes = data.currentUser.assignedRequests?.nodes ?? [];
    const reviewNodes = data.currentUser.reviewRequests?.nodes ?? [];
    const authoredNodes = data.currentUser.authoredRequests?.nodes ?? [];
    const allNodes = [...assignedNodes, ...reviewNodes, ...authoredNodes];

    const mergeRequests = new Map();
    for (const mr of allNodes) {
      projects.add(mr.project.fullPath);
      if (this.state.options.projectExcludes.has(mr.project.fullPath)) {
        continue;
      }

      mergeRequests.set(mr.webUrl, {
        title: mr.title,
        subtitle: mr.author.username,
        icon: "chrome://browser/content/zen-images/favicons/github.svg",
        url: mr.webUrl,
        id: mr.webUrl,
      });
    }

    this.state.projects = projects;
    return mergeRequests.values().toArray();
  }

  async #fetchIssues() {
    const hasAnyFilterEnabled = this.state.options.authorMe || this.state.options.assignedMe;
    if (!hasAnyFilterEnabled) {
      return "zen-live-folder-github-no-filter";
    }

    if (!this.state.username) {
      await this.fetchUsername();
    }

    if (!this.state.username) {
      return "zen-live-folder-github-no-auth";
    }

    const { text } = await this.fetch(this.state.url, {
      method: "POST",
      body: JSON.stringify({
        query: this.#issuesQuery,
        variables: {
          perPage: 30,
          authorUsername: this.state.username,
          assigneeUsernames: [this.state.username],
          includeAssigned: this.state.options.assignedMe,
          includeAuthored: this.state.options.authorMe,
        },
      }),
    });

    const { data } = JSON.parse(text);
    if (!data.authored && !data.assigned) {
      return "zen-live-folder-github-no-auth";
    }

    const allNodes = [...data.authored.nodes, ...data.assigned.nodes];
    const issues = new Map();

    const projects = new Set();

    for (const issue of allNodes) {
      projects.add(issue.reference.split("#")[0]);
      if (this.state.options.projectExcludes.has(issue.reference.split("#")[0])) {
        continue;
      }

      issues.set(issue.webUrl, {
        title: issue.title,
        subtitle: issue.author.username,
        icon: "chrome://browser/content/zen-images/favicons/github.svg",
        url: issue.webUrl,
        id: issue.webUrl,
      });
    }

    this.state.projects = projects;
    return issues.values().toArray();
  }

  get options() {
    const excluded = this.state.options.projectExcludes;
    const projectOptions = Array.from(this.state.projects.union(excluded))
      .sort((a, b) => a.localeCompare(b))
      .map((repo) => ({
        l10nId: "zen-live-folder-github-option-repo",
        l10nArgs: { repo },

        key: "projectExclude",
        value: repo,

        type: "checkbox",
        checked: !excluded.has(repo),
      }));

    if (projectOptions.length) {
      projectOptions.push({ type: "separator" });
    }

    projectOptions.push({
      l10nId: "zen-live-folder-github-option-repo-list-note",
      disabled: true,
    });

    return [
      {
        l10nId: "zen-live-folder-github-option-author-self",
        key: "authorMe",
        checked: this.state.options.authorMe,
      },
      {
        l10nId: "zen-live-folder-github-option-assigned-self",
        key: "assignedMe",
        checked: this.state.options.assignedMe,
      },
      {
        l10nId: "zen-live-folder-github-option-review-requested",
        key: "reviewRequested",
        checked: this.state.options.reviewRequested,
        hidden: this.state.type === "issues",
      },
      { type: "separator" },
      {
        l10nId: "zen-live-folder-github-option-repo-filter",
        key: "projectExclude",
        options: projectOptions,
        // 1 repo + separator + note = 3 options, so if we have less than 4 options it means we don't have any repo to exclude
        disabled: projectOptions.length < 4,
      },
    ];
  }

  onOptionTrigger(option) {
    super.onOptionTrigger(option);

    const key = option.getAttribute("option-key");
    const checked = option.getAttribute("checked") === "true";

    if (key === "refresh") {
      // Manual refresh was triggered, re-fetch just in case
      this.fetchUsername();
    }

    if (!this.options.some((x) => x.key === key)) {
      return;
    }

    if (key === "projectExclude") {
      const repo = option.getAttribute("option-value");
      if (!repo) {
        return;
      }

      const excluded = this.state.options.projectExcludes;
      if (checked) {
        excluded.delete(repo);
      } else {
        excluded.add(repo);
      }

      this.state.options.projectExcludes = excluded;
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
        const tab = this.manager.window.gBrowser.addTrustedTab("https://github.com/login");
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
        projects: Array.from(this.state.projects),
        options: {
          ...this.state.options,
          projectExcludes: Array.from(this.state.options.projectExcludes),
        },
      },
    };
  }
}
