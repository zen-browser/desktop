/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { XPCOMUtils } from 'resource://gre/modules/XPCOMUtils.sys.mjs';
import { UrlbarProvider, UrlbarUtils } from 'resource:///modules/UrlbarUtils.sys.mjs';
import { globalActions } from 'resource:///modules/ZenUBGlobalActions.sys.mjs';

const lazy = {};

const DYNAMIC_TYPE_NAME = 'zen-actions';

// The suggestion index of the actions row within the urlbar results.
const MAX_RECENT_ACTIONS = 5;
const MINIMUM_QUERY_SCORE = 93;

const EN_LOCALE_MATCH = /^en(-.*)$/;

ChromeUtils.defineESModuleGetters(lazy, {
  UrlbarResult: 'resource:///modules/UrlbarResult.sys.mjs',
  UrlbarTokenizer: 'resource:///modules/UrlbarTokenizer.sys.mjs',
  QueryScorer: 'resource:///modules/UrlbarProviderInterventions.sys.mjs',
  BrowserWindowTracker: 'resource:///modules/BrowserWindowTracker.sys.mjs',
});

XPCOMUtils.defineLazyPreferenceGetter(
  lazy,
  'enabledPref',
  'zen.urlbar.suggestions.quick-actions',
  true
);

/**
 * A provider that lets the user view all available global actions for a query.
 */
export class ZenUrlbarProviderGlobalActions extends UrlbarProvider {
  get name() {
    return 'ZenUrlbarProviderGlobalActions';
  }

  /**
   * @returns {Values<typeof UrlbarUtils.PROVIDER_TYPE>}
   */
  get type() {
    return UrlbarUtils.PROVIDER_TYPE.PROFILE;
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
      lazy.enabledPref &&
      queryContext.searchString &&
      queryContext.searchString.length < UrlbarUtils.MAX_TEXT_LENGTH &&
      queryContext.searchString.length > 2 &&
      !lazy.UrlbarTokenizer.REGEXP_LIKE_PROTOCOL.test(queryContext.searchString) &&
      EN_LOCALE_MATCH.test(Services.locale.appLocaleAsBCP47)
    );
  }

  /**
   * @returns All the available global actions.
   */
  get #availableActions() {
    return globalActions.filter((a) =>
      typeof a.isAvailable === 'function' ? a.isAvailable() : true
    );
  }

  /**
   * Starts a search query amongst the available global actions.
   *
   * @param {string} queryContext The query context object
   */
  #findMatchingActions(query) {
    const actions = this.#availableActions;
    let results = [];
    for (let action of actions) {
      const label = action.label;
      const score = this.#calculateFuzzyScore(label, query);
      if (score > MINIMUM_QUERY_SCORE) {
        results.push({
          score,
          action,
        });
      }
    }
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, MAX_RECENT_ACTIONS).map((r) => r.action);
  }

  /**
   * A VS Code-style fuzzy scoring algorithm.
   * @param {string} target The string to score against.
   * @param {string} query The user's search query.
   * @returns {number} A score representing the match quality.
   *
   * @credits Thanks a lot @BibekBhusal0 on GitHub for this implementation!
   */
  #calculateFuzzyScore(target, query) {
    if (!target || !query) return 0;
    const targetLower = target.toLowerCase();
    const queryLower = query.toLowerCase();
    const targetLen = target.length;
    const queryLen = query.length;
    if (queryLen > targetLen) return 0;
    if (queryLen === 0) return 0;
    // 1. Exact match gets the highest score.
    if (targetLower === queryLower) {
      return 200;
    }
    // 2. Exact prefix matches are heavily prioritized.
    if (targetLower.startsWith(queryLower)) {
      return 100 + queryLen;
    }
    // 3. Exact abbreviation (e.g., 'tcm' for 'Toggle Compact Mode')
    const initials = targetLower
      .split(/[\s-_]+/)
      .map((word) => word[0])
      .join('');
    if (initials === queryLower) {
      return 90 + queryLen;
    }
    let score = 0;
    let queryIndex = 0;
    let lastMatchIndex = -1;
    let consecutiveMatches = 0;
    for (let targetIndex = 0; targetIndex < targetLen; targetIndex++) {
      if (queryIndex < queryLen && targetLower[targetIndex] === queryLower[queryIndex]) {
        let bonus = 10;
        // Bonus for matching at the beginning of a word
        if (targetIndex === 0 || [' ', '-', '_'].includes(targetLower[targetIndex - 1])) {
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
    const query = queryContext.searchString.trim().toLowerCase();
    if (!query) {
      return;
    }

    const actionsResults = this.#findMatchingActions(query);
    if (!actionsResults.length) {
      return;
    }

    const ownerGlobal = lazy.BrowserWindowTracker.getTopWindow();
    for (const action of actionsResults) {
      const [payload, payloadHighlights] = lazy.UrlbarResult.payloadAndSimpleHighlights([], {
        suggestion: action.label,
        title: action.label,
        query: queryContext.searchString,
        zenCommand: action.command,
        dynamicType: DYNAMIC_TYPE_NAME,
        icon: action.icon || 'chrome://browser/skin/trending.svg',
        shortcutContent: ownerGlobal.gZenKeyboardShortcutsManager.getShortcutDisplayFromCommand(
          action.command
        ),
      });

      let result = new lazy.UrlbarResult(
        UrlbarUtils.RESULT_TYPE.DYNAMIC,
        UrlbarUtils.RESULT_SOURCE.OTHER_LOCAL,
        payload,
        payloadHighlights
      );
      if (action.suggestedIndex) {
        result.suggestedIndex = action.suggestedIndex;
      }
      addCallback(this, result);
    }
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
    return {
      icon: {
        attributes: {
          src: result.payload.icon || 'chrome://browser/skin/trending.svg',
        },
      },
      titleStrong: {
        textContent: result.payload.title,
        attributes: { dir: 'ltr' },
      },
      shortcutContent: {
        textContent: result.payload.shortcutContent || '',
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
          name: 'icon',
          tag: 'img',
          classList: ['urlbarView-favicon'],
        },
        {
          name: 'title',
          tag: 'span',
          classList: ['urlbarView-title'],
          children: [
            {
              name: 'titleStrong',
              tag: 'strong',
            },
          ],
        },
        {
          name: 'shortcutContent',
          tag: 'span',
          classList: ['urlbarView-shortcutContent'],
        },
      ],
    };
  }

  onEngagement(queryContext, controller, details) {
    const result = details.result;
    const payload = result.payload;
    const command = payload.zenCommand;
    if (!command) {
      return;
    }
    const ownerGlobal = details.element.ownerGlobal;
    const commandToRun = ownerGlobal.document.getElementById(command);
    if (commandToRun) {
      ownerGlobal.gBrowser.selectedBrowser.focus();
      commandToRun.doCommand();
    }
  }
}
