// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { nsZenLiveFolderProvider } from "resource:///modules/zen/ZenLiveFolder.sys.mjs";

const lazy = {};
ChromeUtils.defineESModuleGetters(lazy, {
  GitlabAuth: "resource:///modules/zen/GitlabAuth.sys.mjs",
});

ChromeUtils.defineLazyGetter(
  lazy,
  "l10n",
  () => new Localization(["browser/zen-live-folders.ftl"])
);

const DEFAULT_HOST = "gitlab.com";
const ICON_URL = "chrome://browser/skin/zen-icons/selectable/logo-gitlab.svg";

// Best-effort heuristic: detect a GitLab instance from the active tab's URL.
// Falls back to gitlab.com when nothing convincing is found.
function looksLikeGitlabHost(host) {
  if (!host) {
    return false;
  }
  return host === "gitlab.com" || /(^|\.)gitlab\./i.test(host);
}

export class nsGitlabLiveFolderProvider extends nsZenLiveFolderProvider {
  static type = "gitlab";

  static getDefaultHost(window) {
    try {
      const uri = window?.gBrowser?.selectedBrowser?.currentURI;
      if (uri && (uri.scheme === "https" || uri.scheme === "http")) {
        if (looksLikeGitlabHost(uri.host)) {
          return uri.host;
        }
      }
    } catch {}
    return DEFAULT_HOST;
  }

  constructor({ id, state, manager }) {
    super({ id, state, manager });

    this.state.type = state.type;
    this.state.host = state.host || DEFAULT_HOST;
    this.state.options = state.options ?? {};
    this.state.projects = new Set(state.projects ?? []);
    this.state.options.projectExcludes = new Set(
      state.options.projectExcludes ?? []
    );
  }

  get #apiBase() {
    return `https://${this.state.host}/api/v4`;
  }

  get #resourcePath() {
    return this.state.type === "merge-requests" ? "merge_requests" : "issues";
  }

  async #buildHeaders() {
    const headers = { Accept: "application/json" };
    const token = await lazy.GitlabAuth.getToken(this.state.host);
    if (token) {
      headers["PRIVATE-TOKEN"] = token;
    }
    return headers;
  }

  #buildScopeUrls() {
    const isMergeRequest = this.state.type === "merge-requests";
    const scopes = [];

    if (this.state.options.assignedMe ?? true) {
      scopes.push({ scope: "assigned_to_me" });
    }
    if (this.state.options.authorMe ?? false) {
      scopes.push({ scope: "created_by_me" });
    }
    if (isMergeRequest && (this.state.options.reviewRequested ?? false)) {
      // GitLab uses reviewer_username=__me__ rather than scope= for review-requested.
      scopes.push({ scope: null, reviewer: true });
    }

    return scopes.map(({ scope, reviewer }) => {
      const url = new URL(`${this.#apiBase}/${this.#resourcePath}`);
      url.searchParams.set("state", "opened");
      url.searchParams.set("per_page", "50");
      url.searchParams.set("order_by", "updated_at");
      url.searchParams.set("sort", "desc");
      if (scope) {
        url.searchParams.set("scope", scope);
      }
      if (reviewer) {
        url.searchParams.set("reviewer_username", "__me__");
      }
      return url.href;
    });
  }

  async fetchItems() {
    try {
      const hasAnyFilterEnabled =
        (this.state.options.authorMe ?? false) ||
        (this.state.options.assignedMe ?? true) ||
        (this.state.options.reviewRequested ?? false);

      if (!hasAnyFilterEnabled) {
        return "zen-live-folder-gitlab-no-filter";
      }

      const headers = await this.#buildHeaders();
      const urls = this.#buildScopeUrls();

      const responses = await Promise.all(
        urls.map(url => this.#fetchScope(url, headers))
      );

      const combinedItems = new Map();
      const combinedActiveProjects = new Set();

      for (const response of responses) {
        if (response.authError) {
          return "zen-live-folder-gitlab-no-auth";
        }
        if (!response.items) {
          continue;
        }
        for (const item of response.items) {
          combinedItems.set(item.id, item);
        }
        for (const project of response.activeProjects) {
          combinedActiveProjects.add(project);
        }
      }

      this.state.projects = combinedActiveProjects;

      const excluded = this.state.options.projectExcludes;
      const items = Array.from(combinedItems.values()).filter(
        item => !excluded.has(item.project)
      );

      return items;
    } catch (error) {
      console.error("Error fetching or parsing GitLab items:", error);
      return "zen-live-folder-failed-fetch";
    }
  }

  async #fetchScope(url, headers) {
    const { text, status } = await this.fetch(url, { headers });

    if (status === 401 || status === 403) {
      return { authError: true };
    }
    if (status !== 200) {
      return { items: [], activeProjects: new Set() };
    }

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      return { items: [], activeProjects: new Set() };
    }

    if (!Array.isArray(parsed)) {
      return { items: [], activeProjects: new Set() };
    }

    const items = [];
    const activeProjects = new Set();

    for (const entry of parsed) {
      const project = entry.references?.full
        ? entry.references.full.split(/[#!]/)[0]
        : "";
      if (project) {
        activeProjects.add(project);
      }
      const sigil = this.state.type === "merge-requests" ? "!" : "#";
      items.push({
        id: `${project}${sigil}${entry.iid}`,
        title: entry.title,
        subtitle: entry.author?.username ?? "",
        icon: ICON_URL,
        url: entry.web_url,
        project,
      });
    }

    return { items, activeProjects };
  }

  get options() {
    const excluded = this.state.options.projectExcludes;
    const projectOptions = Array.from(this.state.projects.union(excluded))
      .sort((a, b) => a.localeCompare(b))
      .map(project => ({
        l10nId: "zen-live-folder-gitlab-option-project",
        l10nArgs: { project },

        key: "projectExclude",
        value: project,

        type: "checkbox",
        checked: !excluded.has(project),
      }));

    if (projectOptions.length) {
      projectOptions.push({ type: "separator" });
    }

    projectOptions.push({
      l10nId: "zen-live-folder-gitlab-option-project-list-note",
      disabled: true,
    });

    return [
      {
        l10nId: "zen-live-folder-gitlab-option-instance",
        l10nArgs: { host: this.state.host },
        disabled: true,
      },
      { type: "separator" },
      {
        l10nId: "zen-live-folder-gitlab-option-author-self",
        key: "authorMe",
        checked: this.state.options.authorMe ?? false,
      },
      {
        l10nId: "zen-live-folder-gitlab-option-assigned-self",
        key: "assignedMe",
        checked: this.state.options.assignedMe ?? true,
      },
      {
        l10nId: "zen-live-folder-gitlab-option-review-requested",
        key: "reviewRequested",
        checked: this.state.options.reviewRequested ?? false,
        hidden: this.state.type === "issues",
      },
      { type: "separator" },
      {
        l10nId: "zen-live-folder-gitlab-option-project-filter",
        key: "projectExclude",
        options: projectOptions,
        // 1 project + separator + note = 3 options, so we need at least 4 to enable the menu.
        disabled: projectOptions.length < 4,
      },
      { type: "separator" },
      {
        l10nId: "zen-live-folder-gitlab-option-set-token",
        key: "setToken",
      },
      {
        l10nId: "zen-live-folder-gitlab-option-remove-token",
        key: "removeToken",
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

    switch (key) {
      case "projectExclude": {
        const project = option.getAttribute("option-value");
        if (!project) {
          return;
        }
        const excluded = this.state.options.projectExcludes;
        if (checked) {
          excluded.delete(project);
        } else {
          excluded.add(project);
        }
        this.state.options.projectExcludes = excluded;
        break;
      }
      case "setToken": {
        await this.#promptForToken();
        break;
      }
      case "removeToken": {
        await lazy.GitlabAuth.removeToken(this.state.host);
        break;
      }
      case "authorMe":
      case "assignedMe":
      case "reviewRequested": {
        this.state.options[key] = checked;
        break;
      }
      default:
        return;
    }

    this.refresh();
    this.requestSave();
  }

  async #promptForToken() {
    const window = this.manager.window;
    const [promptText] = await lazy.l10n.formatValues([
      { id: "zen-live-folder-gitlab-prompt-pat", args: { host: this.state.host } },
    ]);
    const input = { value: "" };
    const ok = Services.prompt.prompt(
      window,
      promptText,
      null,
      input,
      null,
      { value: null }
    );
    if (!ok) {
      return;
    }
    const token = (input.value ?? "").trim();
    if (token) {
      await lazy.GitlabAuth.setToken(this.state.host, token);
    } else {
      await lazy.GitlabAuth.removeToken(this.state.host);
    }
  }

  async onActionButtonClick(errorId) {
    super.onActionButtonClick(errorId);

    switch (errorId) {
      case "zen-live-folder-gitlab-no-auth": {
        const tab = this.manager.window.gBrowser.addTrustedTab(
          `https://${this.state.host}/users/sign_in`
        );
        this.manager.window.gBrowser.selectedTab = tab;
        break;
      }
      case "zen-live-folder-gitlab-no-filter": {
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
