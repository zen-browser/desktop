// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { nsZenDOMOperatedFeature } from "chrome://browser/content/zen-components/ZenCommonUtils.mjs";

class nsZenVimManager extends nsZenDOMOperatedFeature {
  _mode = "normal";
  _lastSearch = "";
  _activePrompt = ":";

  _commandline = null;
  _prompt = null;
  _input = null;

  init() {
    this._commandline = document.getElementById("zen-vim-commandline");
    this._prompt = document.getElementById("zen-vim-commandline-prompt");
    this._input = document.getElementById("zen-vim-commandline-input");

    if (!this._commandline || !this._prompt || !this._input) {
      console.warn("[vim] Command line UI not found; Vim mode disabled.");
      return;
    }

    this._input.addEventListener("keydown", this._onCommandLineKeyDown.bind(this));
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

  _executeCommand(rawCommand) {
    const command = rawCommand.trim();
    if (!command) {
      return;
    }

    const [name, ...args] = command.split(/\s+/u);
    switch (name) {
      case "q":
      case "quit":
        this._runCommandById("cmd_quitApplication");
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

  _handleTabCommand(rawQuery) {
    const query = rawQuery.trim();
    if (!query) {
      this._runCommandById("cmd_newNavigatorTab");
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
