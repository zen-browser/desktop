/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const DANGEROUS_URLS = [
  "javascript:alert(document.domain)",
  "file:///etc/passwd",
  "chrome://browser/content/browser.xhtml",
  "resource://gre/modules/Services.sys.mjs",
  "data:text/html,<script>alert(1)</script>",
  "about:config",
  // Case and leading whitespace must not slip past the scheme check.
  "JaVaScRiPt:alert(1)",
  "  javascript:alert(1)",
];

let initialWorkspace;

function splitDoc(url) {
  return {
    shared: {
      type: "splitView",
      tabs: [
        { type: "tab", url, label: "Hostile" },
        { type: "tab", url: "https://example.com/ok", label: "Benign" },
      ],
    },
  };
}

add_setup(async function () {
  initialWorkspace = gZenWorkspaces.activeWorkspace;
  registerCleanupFunction(() => cleanupSpaces(initialWorkspace));
});

add_task(async function test_SchemaRejectsDangerousSchemes() {
  for (const url of DANGEROUS_URLS) {
    const result = await ZenShareClient.validateDocument({
      version: "1",
      ...splitDoc(url),
    });
    Assert.ok(!result.valid, `the schema rejects a document carrying ${url}`);
  }
});

add_task(async function test_SchemaStillAcceptsHttpAndHttps() {
  for (const url of ["https://example.com/a", "http://example.com/b"]) {
    const result = await ZenShareClient.validateDocument({
      version: "1",
      ...splitDoc(url),
    });
    Assert.ok(result.valid, `the schema still accepts ${url}`);
  }
});

add_task(async function test_SplitLinkNeverLoadsADangerousScheme() {
  for (const url of DANGEROUS_URLS) {
    const loaded = [];
    const restoreTab = stubMethod(
      gBrowser,
      "addTrustedTab",
      function (...args) {
        loaded.push(args[0]);
        return Object.getPrototypeOf(this).addTrustedTab.apply(this, args);
      }
    );
    const restorePreview = stubSharePreview(splitDoc(url));
    const restoreToast = stubMethod(gZenUIManager, "showToast", () => {});

    const shareTab = gBrowser.addTrustedTab(`${SHARE_BASE}/split/${SHARE_ID}`, {
      inBackground: false,
    });
    gBrowser.selectedTab = shareTab;

    await TestUtils.waitForCondition(
      () => loaded.includes("https://example.com/ok"),
      `the import ran for ${url}`
    );

    Assert.ok(!loaded.includes(url), `${url} never reaches addTrustedTab`);
    Assert.ok(
      !gBrowser.tabs.some(t => t.linkedBrowser?.currentURI?.spec === url),
      `and no tab in the window is pointed at ${url}`
    );

    restoreToast();
    restorePreview();
    restoreTab();
    if (gBrowser.tabs.includes(shareTab)) {
      BrowserTestUtils.removeTab(shareTab);
    }
    await cleanupSpaces(initialWorkspace);
  }
});
