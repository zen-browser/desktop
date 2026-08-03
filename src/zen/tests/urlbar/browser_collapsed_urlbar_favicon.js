/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_task(async function test_CollapsedUrlbarFaviconTracksSelectedTab() {
  const tabIcon = gBrowser.selectedTab.querySelector(".tab-icon-image");
  const faviconURL =
    "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg'/>";
  Assert.ok(tabIcon, "Selected tab has a favicon element");

  const originalSource = tabIcon.getAttribute("src");
  try {
    tabIcon.setAttribute("src", faviconURL);
    gZenUIManager.updateCollapsedUrlbarFavicon();

    const favicon = document.getElementById("zen-urlbar-tab-favicon");
    Assert.equal(
      favicon.getAttribute("src"),
      faviconURL,
      "URL bar uses the selected tab favicon"
    );
    ok(
      gURLBar.hasAttribute("zen-has-tab-favicon"),
      "URL bar marks the favicon as available"
    );
  } finally {
    if (originalSource) {
      tabIcon.setAttribute("src", originalSource);
    } else {
      tabIcon.removeAttribute("src");
    }
    gZenUIManager.updateCollapsedUrlbarFavicon();
  }
});
