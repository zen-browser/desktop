/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Phase 1 helpers: native tab search (%), Reader discoverability.
 * No custom indexes, no cloud TTS, no DOM scraping of page text.
 */

const OPENPAGE_TOKEN = "%";

function isReaderActive(win) {
  const readerBtn = win.document?.getElementById("reader-mode-button");
  return (
    readerBtn?.getAttribute("readeractive") === "true" ||
    !!win.gBrowser?.selectedBrowser?.currentURI?.spec?.startsWith("about:reader")
  );
}

/**
 * Focus the URL bar with Firefox's native open-tabs restriction (%).
 * Prefers a single stable route: empty bar uses "% "; otherwise TABS searchMode
 * so existing typed text is not destroyed. Fallback prefixes with "% ".
 */
export function searchOpenTabs(win = window) {
  const urlbar = win.gURLBar;
  if (!urlbar) {
    return false;
  }
  try {
    const existing = urlbar.value || "";
    const trimmed = existing.trim();
    urlbar.focus();

    if (!trimmed) {
      urlbar.value = `${OPENPAGE_TOKEN} `;
      const pos = urlbar.value.length;
      urlbar.selectionStart = pos;
      urlbar.selectionEnd = pos;
    } else if (trimmed.startsWith(OPENPAGE_TOKEN)) {
      // Already restricted — keep text, ensure focus.
    } else {
      try {
        const { UrlbarUtils } = ChromeUtils.importESModule(
          "moz-src:///browser/components/urlbar/UrlbarUtils.sys.mjs"
        );
        urlbar.searchMode = {
          source: UrlbarUtils.RESULT_SOURCE.TABS,
          entry: "keywordoffer",
        };
      } catch {
        urlbar.value = `${OPENPAGE_TOKEN} ${trimmed}`;
        urlbar.selectionStart = 2;
        urlbar.selectionEnd = urlbar.value.length;
      }
    }
    urlbar.startQuery?.({ allowAutofill: false });
    return true;
  } catch (error) {
    console.error("[AstraPhase1] searchOpenTabs failed", error);
    return false;
  }
}

/**
 * Open Reader View so the user can use the native Listen control.
 * Does not start speech and does not claim reading has begun.
 */
export function openReaderForReadAloud(win = window) {
  try {
    if (isReaderActive(win)) {
      win.gZenUIManager?.showToast?.("zen-read-aloud-use-listen", {
        timeout: 4000,
      });
      return true;
    }

    const readerBtn = win.document?.getElementById("reader-mode-button");
    const looksCompatible =
      (readerBtn && !readerBtn.hidden) ||
      !!win.gBrowser?.selectedBrowser?.isArticle;

    const cmd = win.document?.getElementById("View:ReaderView");
    if (!looksCompatible && (!cmd || cmd.hasAttribute("disabled"))) {
      win.gZenUIManager?.showToast?.("zen-read-aloud-unavailable", {
        timeout: 4000,
      });
      return false;
    }

    if (cmd && !cmd.hasAttribute("disabled")) {
      cmd.doCommand();
    } else {
      win.goDoCommand?.("View:ReaderView");
    }

    // Confirm Reader actually opened before claiming success.
    win.setTimeout?.(() => {
      if (isReaderActive(win)) {
        win.gZenUIManager?.showToast?.("zen-read-aloud-use-listen", {
          timeout: 4500,
        });
      } else {
        win.gZenUIManager?.showToast?.("zen-read-aloud-unavailable", {
          timeout: 4000,
        });
      }
    }, 350);

    return true;
  } catch (error) {
    console.error("[AstraPhase1] openReaderForReadAloud failed", error);
    win.gZenUIManager?.showToast?.("zen-read-aloud-unavailable", {
      timeout: 4000,
    });
    return false;
  }
}

export function openAboutPage(win, aboutUrl) {
  const target = win || window;
  if (!aboutUrl?.startsWith("about:")) {
    return false;
  }
  try {
    target.openTrustedLinkIn?.(aboutUrl, "tab");
    return true;
  } catch (error) {
    console.error("[AstraPhase1] openAboutPage failed", error);
    return false;
  }
}
