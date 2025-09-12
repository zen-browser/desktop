/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { UrlbarProvider, UrlbarUtils } from 'resource:///modules/UrlbarUtils.sys.mjs';
import { globalActions } from 'resource:///modules/ZenUBGlobalActions.sys.mjs';

const lazy = {};

const DYNAMIC_TYPE_NAME = 'actions';

// The suggestion index of the actions row within the urlbar results.
const SUGGESTED_INDEX = 1;

const EN_LOCALE_MATCH = /^en(-.*)$/;

ChromeUtils.defineESModuleGetters(lazy, {
  UrlbarResult: 'resource:///modules/UrlbarResult.sys.mjs',
  UrlbarTokenizer: 'resource:///modules/UrlbarTokenizer.sys.mjs',
  QueryScorer: 'resource:///modules/UrlbarProviderInterventions.sys.mjs',
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
export class UrlbarProviderGlobalActions extends UrlbarProvider {
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
      lazy.enabledPref ||
      !queryContext.searchString ||
      queryContext.searchString.length > UrlbarUtils.MAX_TEXT_LENGTH ||
      queryContext.searchString.length < 4 ||
      lazy.UrlbarTokenizer.REGEXP_LIKE_PROTOCOL.test(queryContext.searchString) ||
      !EN_LOCALE_MATCH.test(Services.locale.appLocaleAsBCP47)
    );
  }

  /**
   * @returns All the available global actions.
   */
  get #availableActions() {
    return globalActions.filter((a) => a.isAvailable());
  }

  /**
   * Starts a search query amongst the available global actions.
   *
   * @param {string} queryContext The query context object
   */
  #findMatchingActions(query) {
    const actions = this.#availableActions;
    const results = [];
    for (let action of actions) {
      let score = 0;
      const label = action.label;
    }
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

    let payload = {
      actionsResults,
      dynamicType: DYNAMIC_TYPE_NAME,
      inputLength: queryContext.searchString.length,
      input: query,
      query,
    };

    let result = new lazy.UrlbarResult(
      UrlbarUtils.RESULT_TYPE.DYNAMIC,
      UrlbarUtils.RESULT_SOURCE.ACTIONS,
      payload
    );
    result.suggestedIndex = SUGGESTED_INDEX;
    addCallback(this, result);
  }
}
