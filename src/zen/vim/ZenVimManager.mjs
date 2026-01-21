// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { nsZenDOMOperatedFeature } from "chrome://browser/content/zen-components/ZenCommonUtils.mjs";

const MAX_LOCAL_SUGGESTIONS = 3;
const MAX_REMOTE_SUGGESTIONS = 6;
const MAX_HISTORY_SUGGESTIONS = 5;
const MAX_VIM_SUGGESTIONS = 9;

const lazy = {};
ChromeUtils.defineESModuleGetters(lazy, {
  PlacesUtils: "resource://gre/modules/PlacesUtils.sys.mjs",
  PrivateBrowsingUtils: "resource://gre/modules/PrivateBrowsingUtils.sys.mjs",
  SearchSuggestionController:
    "moz-src:///toolkit/components/search/SearchSuggestionController.sys.mjs",
});

class nsZenVimManager extends nsZenDOMOperatedFeature {
  _mode = "normal";
  _lastSearch = "";
  _activePrompt = ":";

  _commandline = null;
  _prompt = null;
  _input = null;
  _suggestBox = null;
  _suggestList = null;
  _suggestions = [];
  _suggestIndex = -1;
  _suggestTimer = null;
  _suggestRequestId = 0;
  _suggestController = null;

  init() {
    this._commandline = document.getElementById("zen-vim-commandline");
    this._prompt = document.getElementById("zen-vim-commandline-prompt");
    this._input = document.getElementById("zen-vim-commandline-input");
    this._suggestBox = document.getElementById("zen-vim-commandline-suggest");
    this._suggestList = document.getElementById(
      "zen-vim-commandline-suggest-list"
    );

    if (!this._commandline || !this._prompt || !this._input) {
      console.warn("[vim] Command line UI not found; Vim mode disabled.");
      return;
    }

    this._input.addEventListener("keydown", this._onCommandLineKeyDown.bind(this));
    this._input.addEventListener("input", this._onCommandLineInput.bind(this));
    this._commandline.addEventListener("mousedown", (event) => {
      event.preventDefault();
      this._input.focus();
    });

    this.setMode("normal");
    this._broadcastMode("normal");
  }

  get mode() {
    return this._mode;
  }

  setMode(mode, { broadcast = true } = {}) {
    if (!mode) {
      return;
    }
    const changed = this._mode !== mode;
    this._mode = mode;
    document.documentElement.setAttribute("zen-vim-mode", mode);
    if (broadcast && changed) {
      this._broadcastMode(mode);
    }
  }

  openCommandLine(prompt) {
    if (!this._commandline || !this._prompt || !this._input) {
      return;
    }

    this._activePrompt = prompt;
    this._prompt.textContent = prompt;
    this._input.value = "";
    this._clearSuggestions();

    this._commandline.hidden = false;
    this._commandline.setAttribute("data-open", "true");
    this._input.focus();

    if (prompt === "/") {
      this._closeFindBar();
      this.setMode("search");
    } else {
      this.setMode("command");
    }
  }

  closeCommandLine({ restoreFocus = true } = {}) {
    if (!this._commandline || !this._input) {
      return;
    }

    this._clearSuggestions();
    this._commandline.hidden = true;
    this._commandline.removeAttribute("data-open");
    this._input.value = "";

    this.setMode("normal");

    if (restoreFocus) {
      try {
        gBrowser.selectedBrowser.focus();
      } catch (e) {
        // ignore
      }
    }
  }

  findAgain(backwards) {
    if (!this._lastSearch) {
      return;
    }

    const finder = gBrowser.selectedBrowser.finder;
    finder.findAgain(this._lastSearch, backwards, false, false);
    finder.highlight(true, this._lastSearch, false);
  }

  _onCommandLineKeyDown(event) {
    if (event.key === "Escape") {
      this.closeCommandLine();
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    if (this._activePrompt === ":" && this._hasSuggestions()) {
      if (event.key === "ArrowDown") {
        this._moveSuggestion(1);
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      if (event.key === "ArrowUp") {
        this._moveSuggestion(-1);
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      if (event.key === "Tab") {
        this._moveSuggestion(1);
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      if (event.key === "Enter") {
        if (this._acceptSuggestion()) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
      }
    }

    if (event.key !== "Enter") {
      return;
    }

    const value = this._input.value || "";
    if (this._activePrompt === "/") {
      this._doSearch(value);
    } else {
      this._executeCommand(value);
    }

    this.closeCommandLine();
    event.preventDefault();
    event.stopPropagation();
  }

  _onCommandLineInput() {
    if (this._activePrompt !== ":") {
      this._clearSuggestions();
      return;
    }

    this._scheduleSuggestUpdate();
  }

  _executeCommand(rawCommand) {
    const command = rawCommand.trim();
    if (!command) {
      return;
    }

    const [name, ...args] = command.split(/\s+/u);
    switch (name) {
      case "noh":
      case "nohlsearch":
        this._clearSearchHighlight();
        break;
      case "q":
      case "quit":
        this._runCommandById("cmd_quitApplication");
        break;
      case "bd":
      case "bdelete":
        this._closeCurrentTab();
        break;
      case "tab":
      case "tabnew":
        this._handleTabCommand(args.join(" "));
        break;
      default:
        console.warn(`[vim] Unknown command: ${command}`);
        break;
    }
  }

  _runCommandById(commandId) {
    const command = document.getElementById(commandId);
    if (command) {
      command.doCommand();
    }
  }

  _closeCurrentTab() {
    const command = document.getElementById("cmd_close");
    if (command) {
      command.doCommand();
      return;
    }

    if (window.gBrowser?.removeCurrentTab) {
      gBrowser.removeCurrentTab({ animate: true });
      return;
    }

    if (window.gBrowser?.selectedTab) {
      gBrowser.removeTab(gBrowser.selectedTab);
    }
  }

  _handleTabCommand(rawQuery) {
    const query = rawQuery.trim();
    if (!query) {
      this._runCommandById("cmd_newNavigatorTab");
      return;
    }

    if (this._looksLikeUrl(query)) {
      this._openUrlInNewTab(this._normalizeUrl(query));
      return;
    }

    this._openSearchTab(query).catch((error) => {
      console.error("[vim] Failed to open search tab:", error);
      this._runCommandById("cmd_newNavigatorTab");
    });
  }

  async _openSearchTab(query) {
    const engine = await Services.search.getDefault();
    const submission = engine.getSubmission(query, null);
    if (!submission?.uri) {
      this._runCommandById("cmd_newNavigatorTab");
      return;
    }

    const params = {
      triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal(),
      forceForeground: true,
    };
    if (submission.postData) {
      params.postData = submission.postData;
    }

    if (typeof window.openLinkIn === "function") {
      window.openLinkIn(submission.uri.spec, "tab", params);
      return;
    }

    const tab = gBrowser.addTab(submission.uri.spec, {
      triggeringPrincipal: params.triggeringPrincipal,
      postData: params.postData || null,
      inBackground: false,
    });
    gBrowser.selectedTab = tab;
  }

  _openUrlInNewTab(url) {
    if (!url) {
      this._runCommandById("cmd_newNavigatorTab");
      return;
    }

    const params = {
      triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal(),
      forceForeground: true,
    };

    if (typeof window.openLinkIn === "function") {
      window.openLinkIn(url, "tab", params);
      return;
    }

    const tab = gBrowser.addTab(url, {
      triggeringPrincipal: params.triggeringPrincipal,
      inBackground: false,
    });
    gBrowser.selectedTab = tab;
  }

  _scheduleSuggestUpdate() {
    if (this._suggestTimer) {
      clearTimeout(this._suggestTimer);
    }
    this._suggestTimer = setTimeout(() => {
      this._suggestTimer = null;
      this._updateTabSuggestions().catch((error) => {
        console.error("[vim] Failed to update suggestions:", error);
      });
    }, 120);
  }

  async _updateTabSuggestions() {
    const query = this._getTabCommandQuery(this._input?.value || "");
    if (!query) {
      this._clearSuggestions();
      return;
    }

    const requestId = ++this._suggestRequestId;
    const items = [];
    const isUrl = this._looksLikeUrl(query);
    if (isUrl) {
      const url = this._normalizeUrl(query);
      items.push({
        type: "url",
        label: url,
        value: url,
        meta: "Open link",
      });
    }

    let engine = null;
    try {
      engine = await Services.search.getDefault();
    } catch (e) {
      // ignore
    }

    if (requestId !== this._suggestRequestId) {
      return;
    }

    const historyItems = await this._fetchHistorySuggestions(query, requestId);
    if (requestId !== this._suggestRequestId) {
      return;
    }

    const engineName = engine?.name || "Search";
    const seen = new Set(items.map((item) => item.value.toLowerCase()));
    for (const item of historyItems) {
      const key = item.value.toLowerCase();
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      items.push(item);
      if (items.length >= MAX_VIM_SUGGESTIONS) {
        break;
      }
    }

    if (items.length < MAX_VIM_SUGGESTIONS) {
      items.push({
        type: "search",
        label: query,
        value: query,
        meta: `Search with ${engineName}`,
      });
    }

    const suggestions = await this._fetchSearchSuggestions(engine, query, requestId);
    if (requestId !== this._suggestRequestId) {
      return;
    }

    for (const suggestion of suggestions) {
      const key = suggestion.toLowerCase();
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      items.push({
        type: "suggestion",
        label: suggestion,
        value: suggestion,
        meta: "Suggestion",
      });
      if (items.length >= MAX_VIM_SUGGESTIONS) {
        break;
      }
    }

    this._renderSuggestions(items);
  }

  async _fetchHistorySuggestions(query, requestId) {
    const trimmed = query.trim();
    if (!trimmed) {
      return [];
    }

    let conn = null;
    try {
      conn = await lazy.PlacesUtils.promiseLargeCacheDBConnection();
    } catch (e) {
      return [];
    }

    if (requestId !== this._suggestRequestId) {
      return [];
    }

    const escaped = this._escapeLike(trimmed);
    const like = `%${escaped}%`;
    const inputPrefix = `${escaped}%`;

    let rows = [];
    try {
      rows = await conn.executeCached(
        `
          SELECT h.url AS url,
                 h.title AS title,
                 IFNULL(i.use_count, 0) AS use_count,
                 h.frecency AS frecency,
                 h.last_visit_date AS last_visit_date
          FROM moz_places h
          LEFT JOIN moz_inputhistory i
                 ON i.place_id = h.id
                AND i.input LIKE :inputPrefix ESCAPE '\\'
          WHERE h.frecency <> 0
            AND h.url NOT LIKE 'place:%'
            AND (h.url LIKE :like ESCAPE '\\' OR h.title LIKE :like ESCAPE '\\')
          ORDER BY use_count DESC, frecency DESC, last_visit_date DESC
          LIMIT :limit
        `,
        {
          like,
          inputPrefix,
          limit: MAX_HISTORY_SUGGESTIONS,
        }
      );
    } catch (e) {
      return [];
    }

    if (requestId !== this._suggestRequestId) {
      return [];
    }

    return rows
      .map((row) => {
        const url = row.getResultByName("url");
        if (!url) {
          return null;
        }
        const title = row.getResultByName("title") || url;
        return {
          type: "history",
          label: title,
          value: url,
          meta: url,
        };
      })
      .filter(Boolean);
  }

  async _fetchSearchSuggestions(engine, query, requestId) {
    if (!engine || !query) {
      return [];
    }

    if (!this._suggestController) {
      this._suggestController = new lazy.SearchSuggestionController();
    }

    const ok = lazy.SearchSuggestionController.engineOffersSuggestions(engine);
    const maxLocalResults = ok ? MAX_LOCAL_SUGGESTIONS : MAX_LOCAL_SUGGESTIONS + 2;
    const maxRemoteResults = ok ? MAX_REMOTE_SUGGESTIONS : 0;

    try {
      const suggestions = await this._suggestController.fetch({
        searchString: query,
        inPrivateBrowsing: lazy.PrivateBrowsingUtils.isBrowserPrivate(
          gBrowser.selectedBrowser
        ),
        engine,
        maxLocalResults,
        maxRemoteResults,
      });

      if (requestId !== this._suggestRequestId || !suggestions) {
        return [];
      }

      const local = suggestions.local || [];
      const remote = suggestions.remote || [];
      return [...local, ...remote].filter(Boolean);
    } catch (e) {
      return [];
    }
  }

  _renderSuggestions(items) {
    if (!this._suggestBox || !this._suggestList) {
      return;
    }

    if (!items.length) {
      this._clearSuggestions();
      return;
    }

    this._suggestions = items;
    this._suggestList.textContent = "";

    for (const [index, item] of items.entries()) {
      const row = document.createElement("div");
      row.classList.add("zen-vim-commandline-suggest-item");
      row.dataset.index = String(index);
      row.dataset.kind = item.type;

      const kind = document.createElement("div");
      kind.classList.add("zen-vim-commandline-suggest-kind");
      kind.textContent =
        item.type === "url"
          ? "URL"
          : item.type === "history"
            ? "HIST"
            : item.type === "search"
              ? "SEARCH"
              : "SUGG";

      const label = document.createElement("div");
      label.classList.add("zen-vim-commandline-suggest-label");
      label.textContent = item.label;

      const meta = document.createElement("div");
      meta.classList.add("zen-vim-commandline-suggest-meta");
      meta.textContent = item.meta || "";

      row.append(kind, label, meta);
      row.addEventListener("mousedown", (event) => {
        event.preventDefault();
        event.stopPropagation();
        this._setSuggestionIndex(index);
        this._acceptSuggestion();
      });
      this._suggestList.append(row);
    }

    this._suggestBox.hidden = false;
    this._suggestBox.setAttribute("data-open", "true");
    this._setSuggestionIndex(0);
  }

  _setSuggestionIndex(index) {
    if (!this._suggestList || !this._suggestions.length) {
      this._suggestIndex = -1;
      return;
    }

    const clamped = Math.max(0, Math.min(index, this._suggestions.length - 1));
    const previous = this._suggestList.querySelector(".is-selected");
    if (previous) {
      previous.classList.remove("is-selected");
    }

    this._suggestIndex = clamped;
    const current = this._suggestList.querySelector(
      `[data-index="${clamped}"]`
    );
    if (current) {
      current.classList.add("is-selected");
      current.scrollIntoView({ block: "nearest" });
    }
  }

  _moveSuggestion(delta) {
    if (!this._suggestions.length) {
      return;
    }
    const count = this._suggestions.length;
    const startIndex = this._suggestIndex >= 0 ? this._suggestIndex : 0;
    const nextIndex = (startIndex + delta + count) % count;
    this._setSuggestionIndex(nextIndex);
  }

  _acceptSuggestion() {
    if (!this._hasSuggestions()) {
      return false;
    }

    const index = this._suggestIndex >= 0 ? this._suggestIndex : 0;
    const suggestion = this._suggestions[index];
    if (!suggestion) {
      return false;
    }

    if (suggestion.type === "url" || suggestion.type === "history") {
      this._openUrlInNewTab(suggestion.value);
    } else {
      this._openSearchTab(suggestion.value).catch((error) => {
        console.error("[vim] Failed to open suggestion:", error);
        this._runCommandById("cmd_newNavigatorTab");
      });
    }

    this.closeCommandLine();
    return true;
  }

  _hasSuggestions() {
    return (
      !!this._suggestions.length &&
      !!this._suggestBox &&
      !this._suggestBox.hidden
    );
  }

  _clearSuggestions() {
    if (this._suggestTimer) {
      clearTimeout(this._suggestTimer);
      this._suggestTimer = null;
    }
    this._suggestRequestId += 1;
    this._suggestions = [];
    this._suggestIndex = -1;
    if (this._suggestList) {
      this._suggestList.textContent = "";
    }
    if (this._suggestBox) {
      this._suggestBox.hidden = true;
      this._suggestBox.removeAttribute("data-open");
    }
  }

  _getTabCommandQuery(rawValue) {
    const match = rawValue.match(/^\s*(tab|tabnew)\b(.*)$/iu);
    if (!match) {
      return "";
    }
    const query = (match[2] || "").trim();
    return query;
  }

  _escapeLike(value) {
    return value.replace(/[\\%_]/gu, (match) => `\\${match}`);
  }

  _looksLikeUrl(value) {
    const trimmed = value.trim();
    if (!trimmed || /\s/u.test(trimmed)) {
      return false;
    }
    if (/^[a-z][a-z0-9+.-]*:/iu.test(trimmed)) {
      return true;
    }
    if (/^www\./iu.test(trimmed)) {
      return true;
    }
    if (
      /\.(com|edu|org|net|gov|io|co|ai|dev|app|info|biz|me|tv)(\/|$)/iu.test(
        trimmed
      )
    ) {
      return true;
    }
    if (/^\d{1,3}(\.\d{1,3}){3}(:\d+)?(\/|$)/u.test(trimmed)) {
      return true;
    }
    if (/^localhost(:\d+)?(\/|$)/iu.test(trimmed)) {
      return true;
    }
    return false;
  }

  _normalizeUrl(value) {
    const trimmed = value.trim();
    if (/^[a-z][a-z0-9+.-]*:/iu.test(trimmed)) {
      return trimmed;
    }
    return `https://${trimmed}`;
  }

  _doSearch(rawQuery) {
    const query = rawQuery.trim();
    if (!query) {
      return;
    }

    this._lastSearch = query;

    const finder = gBrowser.selectedBrowser.finder;
    finder.fastFind(query, false, false);
    finder.highlight(true, query, false);
  }

  _clearSearchHighlight() {
    try {
      const finder = gBrowser?.selectedBrowser?.finder;
      if (!finder) {
        return;
      }
      finder.removeSelection();
      finder.highlight(false);
    } catch (e) {
      // ignore
    }
  }

  async _closeFindBar() {
    try {
      if (window.gFindBarInitialized && window.gFindBar) {
        window.gFindBar.close(true);
        return;
      }
      if (window.gFindBarPromise) {
        const bar = await window.gFindBarPromise;
        bar.close(true);
      }
    } catch (e) {
      // ignore
    }
  }

  _broadcastMode(mode) {
    if (!window.gBrowser) {
      return;
    }

    for (const browser of gBrowser.browsers) {
      if (!browser?.browsingContext) {
        continue;
      }
      const contexts = browser.browsingContext.getAllBrowsingContextsInSubtree();
      for (const context of contexts) {
        const actor = context.currentWindowGlobal?.getActor("ZenVim");
        actor?.sendAsyncMessage("ZenVim:SetMode", { mode });
      }
    }
  }
}

window.gZenVimManager = new nsZenVimManager();
