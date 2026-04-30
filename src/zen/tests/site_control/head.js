/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const HTTP_PAGE = "https://mochi.test:8888/";
const HTTPS_PAGE = "https://example.com/";

async function loadUrl(url) {
  const browser = gBrowser.selectedBrowser;
  const loaded = BrowserTestUtils.browserLoaded(browser, false, url);
  BrowserTestUtils.startLoadingURIString(browser, url);
  await loaded;
}

function siteDataIcon() {
  return document.getElementById("zen-site-data-icon-button");
}

function siteDataPanel() {
  return document.getElementById("zen-unified-site-data-panel");
}

async function openSiteDataPanel() {
  // Make sure its closed
  await closeSiteDataPanel();
  await new Promise(r => setTimeout(r, 500));
  gNavToolbox.setAttribute("zen-has-implicit-hover", "true");
  await new Promise(r => setTimeout(r, 500));
  const panel = siteDataPanel();
  const shown = BrowserTestUtils.waitForPopupEvent(panel, "shown");
  EventUtils.synthesizeMouseAtCenter(siteDataIcon(), {});
  await shown;
  return panel;
}

async function closeSiteDataPanel() {
  const panel = siteDataPanel();
  if (panel.state === "closed") {
    return;
  }
  const hidden = BrowserTestUtils.waitForPopupEvent(panel, "hidden");
  panel.hidePopup(true);
  await hidden;
}
