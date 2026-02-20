/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { XPCOMUtils } from "resource://gre/modules/XPCOMUtils.sys.mjs";
import {
  UrlbarProvider,
  UrlbarUtils,
} from "moz-src:///browser/components/urlbar/UrlbarUtils.sys.mjs";
import { globalActions } from "resource:///modules/ZenUBGlobalActions.sys.mjs";
import { zenUrlbarResultsLearner } from "./ZenUBResultsLearner.sys.mjs";

const lazy = {};

const DYNAMIC_TYPE_NAME = "zen-actions";

// The suggestion index of the actions row within the urlbar results.
const MAX_RECENT_ACTIONS = 5;

const MINIMUM_QUERY_SCORE = 92;
const MINIMUM_PREFIXED_QUERY_SCORE = 30;

ChromeUtils.defineESModuleGetters(lazy, {
  UrlbarResult: "moz-src:///browser/components/urlbar/UrlbarResult.sys.mjs",
  BrowserWindowTracker: "resource:///modules/BrowserWindowTracker.sys.mjs",
  AddonManager: "resource://gre/modules/AddonManager.sys.mjs",
  UrlUtils: "resource://gre/modules/UrlUtils.sys.mjs",
});

XPCOMUtils.defineLazyPreferenceGetter(
  lazy,
  "enabledPref",
  "zen.urlbar.suggestions.quick-actions",
  true
);

/**
 * A convenience function that takes a payload annotated with
 * UrlbarUtils.HIGHLIGHT enums and returns the payload and the payload's
 * highlights. Use this function when the highlighting required by your
 * payload is based on simple substring matching, as done by
 * UrlbarUtils.getTokenMatches(). Pass the return values as the `payload` and
 * `payloadHighlights` params of the UrlbarResult constructor.
 * `payloadHighlights` is optional. If omitted, payload will not be
 * highlighted.
 *
 * If the payload doesn't have a title or has an empty title, and it also has
 * a URL, then this function also sets the title to the URL's domain.
 *
 * @param {Array} tokens The tokens that should be highlighted in each of the
 *        payload properties.
 * @param {object} payloadInfo An object that looks like this:
 *        { payloadPropertyName: payloadPropertyInfo }
 *
 *        Each payloadPropertyInfo may be either a string or an array.  If
 *        it's a string, then the property value will be that string, and no
 *        highlighting will be applied to it.  If it's an array, then it
 *        should look like this: [payloadPropertyValue, highlightType].
 *        payloadPropertyValue may be a string or an array of strings.  If
 *        it's a string, then the payloadHighlights in the return value will
 *        be an array of match highlights as described in
 *        UrlbarUtils.getTokenMatches().  If it's an array, then
 *        payloadHighlights will be an array of arrays of match highlights,
 *        one element per element in payloadPropertyValue.
 * @returns {{ payload: object, payloadHighlights: object }}
 */
function payloadAndSimpleHighlights(tokens, payloadInfo) {
  let payload = {};
  let highlightTypes = {};
  for (let [name, valueOrValues] of Object.entries(payloadInfo)) {
    if (Array.isArray(valueOrValues)) {
      if (valueOrValues.length) {
        payload[name] = valueOrValues[0];
        let highlightType = valueOrValues[1];
        if (highlightType) {
          highlightTypes[name] = highlightType;
        }
      }
    } else if (valueOrValues != undefined) {
      payload[name] = valueOrValues;
    }
  }
  if (!payload.title && !payload.fallbackTitle && payload.url && typeof payload.url == "string") {
    // If there's no title, show the domain as the title. Not all valid URLs
    // have a domain.
    highlightTypes.title = UrlbarUtils.HIGHLIGHT.TYPED;
    try {
      payload.title = new URL(payload.url).URI.displayHostPort;
    } catch (e) {}
  }
  if (payload.url) {
    // For display purposes we need to unescape the url.
    payload.displayUrl = UrlbarUtils.prepareUrlForDisplay(payload.url);
    highlightTypes.displayUrl = highlightTypes.url;
  }
  // For performance reasons limit excessive string lengths, to reduce the
  // amount of string matching we do here, and avoid wasting resources to
  // handle long textruns that the user would never see anyway.
  for (let prop of ["displayUrl", "title", "suggestion"]) {
    let value = payload[prop];
    if (typeof value == "string") {
      payload[prop] = value.substring(0, UrlbarUtils.MAX_TEXT_LENGTH);
    }
  }
  let payloadHighlights = {};
  if (tokens) {
    for (let [name, highlightType] of Object.entries(highlightTypes)) {
      let value = payload[name];
      let highlights = Array.isArray(value)
        ? value.map((subval) => UrlbarUtils.getTokenMatches(tokens, subval, highlightType))
        : UrlbarUtils.getTokenMatches(tokens, value || "", highlightType);
      if (highlights.length) {
        payloadHighlights[name] = highlights;
      }
    }
  }
  return { payload, payloadHighlights };
}

/**
 * A provider that lets the user view all available global actions for a query.
 */
export class ZenUrlbarProviderGlobalActions extends UrlbarProvider {
  #seenCommands = new Set();

  constructor() {
    super();
    lazy.UrlbarResult.addDynamicResultType(DYNAMIC_TYPE_NAME);
  }

  get name() {
    return "ZenUrlbarProviderGlobalActions";
  }

  /**
   * @returns {Values<typeof UrlbarUtils.PROVIDER_TYPE>}
   */
  get type() {
    return UrlbarUtils.PROVIDER_TYPE.HEURISTIC;
  }

  /**
   * Whether this provider should be invoked for the given context.
   * If this method returns false, the providers manager won't start a query
   * with this provider, to save on resources.
   *
   * @param {UrlbarQueryContext} queryContext The query context object
   */
  async isActive(queryContext) {
    return (
      queryContext.searchMode?.source == UrlbarUtils.RESULT_SOURCE.ZEN_ACTIONS ||
      (lazy.enabledPref &&
        queryContext.searchString &&
        queryContext.searchString.length < UrlbarUtils.MAX_TEXT_LENGTH &&
        queryContext.searchString.length > 2 &&
        !lazy.UrlUtils.REGEXP_LIKE_PROTOCOL.test(queryContext.searchString))
    );
  }

  #getWorkspaceActions(window) {
    if (window.gZenWorkspaces.privateWindowOrDisabled) {
      return [];
    }
    const workspaces = window.gZenWorkspaces.getWorkspaces();
    if (!workspaces?.length) {
      return [];
    }
    let actions = [];
    const activeSpaceUUID = window.gZenWorkspaces.activeWorkspace;
    for (const workspace of workspaces) {
      if (workspace.uuid !== activeSpaceUUID) {
        const accentColor = window.gZenWorkspaces
          .workspaceElement(workspace.uuid)
          ?.style.getPropertyValue("--zen-primary-color");
        actions.push({
          label: "Focus on",
          extraPayload: {
            workspaceId: workspace.uuid,
            prettyName: workspace.name,
            prettyIcon: workspace.icon,
            accentColor,
          },
          commandId: `zen:workspace-${workspace.uuid}`,
          icon: "chrome://browser/skin/zen-icons/forward.svg",
        });
      }
    }
    return actions;
  }

  async #getExtensionActions(window) {
    const addons = await lazy.AddonManager.getAddonsByTypes(["extension"]);
    if (window.gBrowser.selectedTab.hasAttribute("zen-empty-tab")) {
      // Don't show extension actions on empty tabs, as extensions can't run there.
      return [];
    }
    return addons
      .filter(
        (addon) =>
          addon.isActive &&
          !addon.isSystem &&
          window.gUnifiedExtensions.browserActionFor(window.WebExtensionPolicy.getByID(addon.id))
      )
      .map((addon) => {
        return {
          icon: "chrome://browser/skin/zen-icons/extension.svg",
          label: "Extension",
          commandId: `zen:extension-${addon.id}`,
          extraPayload: {
            extensionId: addon.id,
            prettyName: addon.name,
            prettyIcon: addon.iconURL,
          },
        };
      });
  }

  /**
   * @param {Window} window The window to check available actions for.
   * @returns {Array} All the available global actions.
   */
  async #getAvailableActions(window) {
    return globalActions
      .filter((a) => a.isAvailable(window))
      .concat(this.#getWorkspaceActions(window))
      .concat(await this.#getExtensionActions(window));
  }

  /**
   * Starts a search query amongst the available global actions.
   *
   * @param {string} query The user's search query.
   * @param {boolean} isPrefixed Whether the query is prefixed.
   */
  async #findMatchingActions(query, isPrefixed) {
    const window = lazy.BrowserWindowTracker.getTopWindow();
    const actions = await this.#getAvailableActions(window);
    let results = [];
    for (let action of actions) {
      if (isPrefixed && query.length < 1) {
        results.push({ action, score: 100 });
        continue;
      }
      const label = action.extraPayload?.prettyName || action.label;
      const score = this.#calculateFuzzyScore(label, query);
      if (score > (isPrefixed ? MINIMUM_PREFIXED_QUERY_SCORE : MINIMUM_QUERY_SCORE)) {
        results.push({
          score,
          action,
        });
      }
    }
    results.sort((a, b) => b.score - a.score);
    // We must show all we can when prefixed, to avoid showing no results.
    if (isPrefixed) {
      return results.map((r) => r.action);
    }
    return results.slice(0, MAX_RECENT_ACTIONS).map((r) => r.action);
  }

  /**
   * A VS Code-style fuzzy scoring algorithm.
   *
   * @param {string} target The string to score against.
   * @param {string} query The user's search query.
   * @returns {number} A score representing the match quality.
   *
   * -credits: Thanks a lot @BibekBhusal0 on GitHub for this implementation!
   */
  #calculateFuzzyScore(target, query) {
    if (!target || !query) {
      return 0;
    }
    const targetLower = target.toLowerCase();
    const queryLower = query.toLowerCase();
    const targetLen = target.length;
    const queryLen = query.length;
    if (queryLen > targetLen) {
      return 0;
    }
    if (queryLen === 0) {
      return 0;
    }
    // 1. Exact match gets the highest score.
    if (targetLower === queryLower) {
      return 200;
    }
    // 2. Exact prefix matches are heavily prioritized.
    if (targetLower.startsWith(queryLower)) {
      return 100 + queryLen;
    }
    let score = 0;
    let queryIndex = 0;
    let lastMatchIndex = -1;
    let consecutiveMatches = 0;
    for (let targetIndex = 0; targetIndex < targetLen; targetIndex++) {
      if (queryIndex < queryLen && targetLower[targetIndex] === queryLower[queryIndex]) {
        let bonus = 10;
        // Bonus for matching at the beginning of a word
        if (targetIndex === 0 || [" ", "-", "_"].includes(targetLower[targetIndex - 1])) {
          bonus += 15;
        }
        // Bonus for consecutive matches
        if (lastMatchIndex === targetIndex - 1) {
          consecutiveMatches++;
          bonus += 20 * consecutiveMatches;
        } else {
          consecutiveMatches = 0;
        }
        // Penalty for distance from the last match
        if (lastMatchIndex !== -1) {
          const distance = targetIndex - lastMatchIndex;
          bonus -= Math.min(distance - 1, 10); // Cap penalty
        }
        score += bonus;
        lastMatchIndex = targetIndex;
        queryIndex++;
      }
    }
    return queryIndex === queryLen ? score : 0;
  }

  async startQuery(queryContext, addCallback) {
    const query = queryContext.trimmedLowerCaseSearchString;
    const isPrefixed = queryContext.searchMode?.source == UrlbarUtils.RESULT_SOURCE.ZEN_ACTIONS;
    if (!query && !isPrefixed) {
      return;
    }

    const actionsResults = await this.#findMatchingActions(query, isPrefixed);
    if (!actionsResults.length) {
      return;
    }

    const ownerGlobal = lazy.BrowserWindowTracker.getTopWindow();
    let finalResults = [];
    for (const action of actionsResults) {
      const { payload, payloadHighlights } = payloadAndSimpleHighlights([], {
        suggestion: action.label,
        title: action.label,
        zenCommand: action.command,
        dynamicType: DYNAMIC_TYPE_NAME,
        zenAction: true,
        query: isPrefixed ? action.label.trimStart() : queryContext.searchString,
        icon: action.icon,
        shortcutContent: ownerGlobal.gZenKeyboardShortcutsManager.getShortcutDisplayFromCommand(
          action.command
        ),
        keywords: action.label.split(" "),
        ...action.extraPayload,
      });

      const shouldBePrioritized =
        zenUrlbarResultsLearner.shouldPrioritize(action.commandId) && !isPrefixed;
      let result = new lazy.UrlbarResult({
        type: UrlbarUtils.RESULT_TYPE.DYNAMIC,
        source: UrlbarUtils.RESULT_SOURCE.ZEN_ACTIONS,
        payload,
        highlights: payloadHighlights,
        heuristic: shouldBePrioritized,
        suggestedIndex: !shouldBePrioritized
          ? zenUrlbarResultsLearner.getDeprioritizeIndex(action.commandId)
          : undefined,
      });
      result.commandId = action.commandId;
      if (!(isPrefixed && query.length < 2)) {
        // We dont want to record prefixed results, as the user explicitly asked for them.
        // Selecting other results would de-prioritize these actions unfairly.
        this.#seenCommands.add(action.commandId);
      }
      finalResults.push(result);
    }
    let i = 0;
    zenUrlbarResultsLearner.sortCommandsByPriority(finalResults).forEach((result) => {
      if (isPrefixed && i === 0 && query.length > 1) {
        result.heuristic = true;
        delete result.suggestedIndex;
      }
      addCallback(this, result);
      i++;
    });
  }

  /**
   * Gets the provider's priority.
   *
   * @returns {number} The provider's priority for the given query.
   */
  getPriority() {
    return 0;
  }

  /**
   * This is called only for dynamic result types, when the urlbar view updates
   * the view of one of the results of the provider.  It should return an object
   * describing the view update.
   *
   * @param {UrlbarResult} result The result whose view will be updated.
   * @returns {object} An object describing the view update.
   */
  getViewUpdate(result) {
    const prettyIconIsSvg =
      result.payload.prettyIcon &&
      (result.payload.prettyIcon.endsWith(".svg") || result.payload.prettyIcon.endsWith(".png"));
    return {
      icon: {
        attributes: {
          src: result.payload.icon || "chrome://browser/skin/trending.svg",
        },
      },
      titleStrong: {
        textContent: result.payload.title,
        attributes: { dir: "ltr" },
      },
      shortcutContent: {
        textContent: result.payload.shortcutContent || "",
      },
      prettyName: {
        attributes: {
          hidden: !result.payload.prettyName,
          style: `--zen-primary-color: ${result.payload.accentColor || "currentColor"}`,
        },
      },
      prettyNameTitle: {
        /* eslint-disable-next-line no-nested-ternary */
        textContent: result.payload.prettyName
          ? prettyIconIsSvg || !result.payload.prettyIcon
            ? result.payload.prettyName
            : `${result.payload.prettyIcon}  ${result.payload.prettyName}`
          : "",
        attributes: { dir: "ltr" },
      },
      prettyNameIcon: {
        attributes: {
          src: result.payload.prettyIcon || "",
          hidden: !prettyIconIsSvg || !result.payload.prettyIcon,
        },
      },
    };
  }

  getViewTemplate() {
    return {
      attributes: {
        selectable: true,
      },
      children: [
        {
          name: "icon",
          tag: "img",
          classList: ["urlbarView-favicon"],
        },
        {
          name: "title",
          tag: "span",
          classList: ["urlbarView-title"],
          children: [
            {
              name: "titleStrong",
              tag: "strong",
            },
          ],
        },
        {
          tag: "span",
          classList: ["urlbarView-prettyName"],
          hidden: true,
          name: "prettyName",
          children: [
            {
              tag: "img",
              name: "prettyNameIcon",
              attributes: { hidden: true },
            },
            {
              name: "prettyNameTitle",
              tag: "span",
            },
          ],
        },
        {
          name: "shortcutContent",
          tag: "span",
          classList: ["urlbarView-shortcutContent"],
        },
      ],
    };
  }

  onSearchSessionEnd(_queryContext, _controller, details) {
    // We should only record the execution if a result was actually used.
    // Otherwise we would start de-prioritizing commands that were never used.
    if (details?.result) {
      let usedCommand = null;
      if (details?.provider === this.name) {
        usedCommand = details.result?.commandId;
      }
      zenUrlbarResultsLearner.recordExecution(usedCommand, [...this.#seenCommands]);
    }
    this.#seenCommands = new Set();
  }

  onEngagement(queryContext, controller, details) {
    const result = details.result;
    const payload = result.payload;
    const command = payload.zenCommand;
    const ownerGlobal = details.element.ownerGlobal;
    ownerGlobal.gBrowser.selectedBrowser.focus();
    if (typeof command === "function") {
      command(ownerGlobal);
      return;
    }
    // Switch workspace if theres a workspaceId in the payload.
    if (payload.workspaceId) {
      ownerGlobal.gZenWorkspaces.changeWorkspaceWithID(payload.workspaceId);
      return;
    }
    if (payload.extensionId) {
      const action = ownerGlobal.gUnifiedExtensions.browserActionFor(
        ownerGlobal.WebExtensionPolicy.getByID(payload.extensionId)
      );
      if (action) {
        action.triggerAction(ownerGlobal);
      }
      return;
    }
    if (!command) {
      return;
    }
    const commandToRun = ownerGlobal.document.getElementById(command);
    if (commandToRun) {
      commandToRun.doCommand();
    }
  }
}
