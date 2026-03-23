/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import {
  UrlbarProvider,
  UrlbarUtils,
} from "moz-src:///browser/components/urlbar/UrlbarUtils.sys.mjs";

const lazy = {};

const DYNAMIC_TYPE_NAME = "zen-workspace";

ChromeUtils.defineESModuleGetters(lazy, {
  UrlbarResult: "moz-src:///browser/components/urlbar/UrlbarResult.sys.mjs",
  BrowserWindowTracker: "resource:///modules/BrowserWindowTracker.sys.mjs",
});

/**
 * A provider that shows workspace switching results when the user types '!'
 * in the URL bar, or when in the ZEN_WORKSPACES search mode.
 */
export class ZenUrlbarProviderWorkspaces extends UrlbarProvider {
  constructor() {
    super();
    lazy.UrlbarResult.addDynamicResultType(DYNAMIC_TYPE_NAME);
  }

  get name() {
    return "ZenUrlbarProviderWorkspaces";
  }

  /**
   * @returns {Values<typeof UrlbarUtils.PROVIDER_TYPE>}
   */
  get type() {
    return UrlbarUtils.PROVIDER_TYPE.HEURISTIC;
  }

  /**
   * Whether this provider should be invoked for the given context.
   *
   * @param {UrlbarQueryContext} queryContext The query context object
   */
  async isActive(queryContext) {
    return (
      queryContext.searchMode?.source ===
      UrlbarUtils.RESULT_SOURCE.ZEN_WORKSPACES
    );
  }

  /**
   * Calculates a simple fuzzy score for matching a workspace name against a query.
   *
   * @param {string} target The workspace name to score.
   * @param {string} query The user's search query.
   * @returns {number} A score representing the match quality (higher is better).
   */
  #calculateScore(target, query) {
    if (!query) {
      return 1;
    }
    const targetLower = target.toLowerCase();
    const queryLower = query.toLowerCase();
    if (targetLower === queryLower) {
      return 200;
    }
    if (targetLower.startsWith(queryLower)) {
      return 100 + queryLower.length;
    }
    if (targetLower.includes(queryLower)) {
      return 50;
    }
    // Fuzzy: check all query chars appear in order
    let qi = 0;
    for (let i = 0; i < targetLower.length && qi < queryLower.length; i++) {
      if (targetLower[i] === queryLower[qi]) {
        qi++;
      }
    }
    return qi === queryLower.length ? 10 : 0;
  }

  /**
   * Starts a search query for available workspaces.
   *
   * @param {UrlbarQueryContext} queryContext
   * @param {Function} addCallback
   */
  async startQuery(queryContext, addCallback) {
    const query = queryContext.trimmedLowerCaseSearchString;
    const window = lazy.BrowserWindowTracker.getTopWindow();

    if (window.gZenWorkspaces.privateWindowOrDisabled) {
      return;
    }

    const workspaces = window.gZenWorkspaces.getWorkspaces();
    if (!workspaces?.length) {
      return;
    }

    const activeSpaceUUID = window.gZenWorkspaces.activeWorkspace;

    // Score and filter workspaces (exclude the currently active workspace)
    let scored = [];
    for (const workspace of workspaces) {
      if (workspace.uuid === activeSpaceUUID) {
        continue;
      }
      const score = this.#calculateScore(workspace.name || "", query);
      if (!query || score > 0) {
        scored.push({ workspace, score });
      }
    }

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);

    let isFirst = true;
    for (const { workspace } of scored) {
      const accentColor = window.gZenWorkspaces
        .workspaceElement(workspace.uuid)
        ?.style.getPropertyValue("--zen-primary-color");

      const prettyIconIsSvgOrPng =
        workspace.icon &&
        (workspace.icon.endsWith(".svg") || workspace.icon.endsWith(".png"));

      const result = new lazy.UrlbarResult({
        type: UrlbarUtils.RESULT_TYPE.DYNAMIC,
        source: UrlbarUtils.RESULT_SOURCE.ZEN_WORKSPACES,
        payload: {
          dynamicType: DYNAMIC_TYPE_NAME,
          workspaceId: workspace.uuid,
          workspaceName: workspace.name,
          workspaceIcon: workspace.icon,
          accentColor: accentColor || "",
          prettyIconIsSvgOrPng,
          icon: "chrome://browser/skin/zen-icons/forward.svg",
        },
        heuristic: isFirst,
      });
      addCallback(this, result);
      isFirst = false;
    }
  }

  /**
   * Provides the view template for workspace results.
   */
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
      ],
    };
  }

  /**
   * Provides the view update for a workspace result.
   *
   * @param {UrlbarResult} result
   */
  getViewUpdate(result) {
    const { workspaceName, workspaceIcon, accentColor, prettyIconIsSvgOrPng } =
      result.payload;
    return {
      icon: {
        attributes: {
          src: result.payload.icon,
        },
      },
      titleStrong: {
        textContent: "Switch to",
        attributes: { dir: "ltr" },
      },
      prettyName: {
        attributes: {
          hidden: !workspaceName,
          style: `--zen-primary-color: ${accentColor || "currentColor"}`,
        },
      },
      prettyNameTitle: {
        /* eslint-disable-next-line no-nested-ternary */
        textContent: workspaceName
          ? prettyIconIsSvgOrPng || !workspaceIcon
            ? workspaceName
            : `${workspaceIcon}  ${workspaceName}`
          : "",
        attributes: { dir: "ltr" },
      },
      prettyNameIcon: {
        attributes: {
          src: workspaceIcon || "",
          hidden: !prettyIconIsSvgOrPng || !workspaceIcon,
        },
      },
    };
  }

  /**
   * Handles user selection of a workspace result.
   *
   * @param {UrlbarQueryContext} queryContext
   * @param {UrlbarController} controller
   * @param {object} details
   */
  onEngagement(queryContext, controller, details) {
    const result = details.result;
    const { workspaceId } = result.payload;
    const ownerGlobal = details.element.ownerGlobal;
    ownerGlobal.gBrowser.selectedBrowser.focus();
    ownerGlobal.gZenWorkspaces.changeWorkspaceWithID(workspaceId);
  }
}
