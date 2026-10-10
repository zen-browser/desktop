/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_task(async function test_partitioned_principal_to_inherit() {
  // Create a new tab.
  let tab = await BrowserTestUtils.openNewForegroundTab(
    gBrowser,
    "https://example.com"
  );
  let browser = tab.linkedBrowser;

  // Get the last entry in the session history.
  let sh = browser.browsingContext.sessionHistory;
  let entry = sh.getEntryAtIndex(sh.count - 1);
  let partitionedPrincipalToInherit = entry.partitionedPrincipalToInherit;

  // Check that the partitioned principal to inherit is properly set.
  ok(partitionedPrincipalToInherit, "partitionedPrincipalToInherit is set");
  is(
    partitionedPrincipalToInherit.originAttributes.partitionKey,
    "(https,example.com)",
    "correct partitionKey"
  );

  BrowserTestUtils.removeTab(tab);
});

add_task(async function test_partitioned_Principal_to_inherit_in_iframe() {
  // Create a new tab.
  let tab = await BrowserTestUtils.openNewForegroundTab(
    gBrowser,
    "https://example.com"
  );
  let browser = tab.linkedBrowser;

  // Load a same-origin iframe
  await SpecialPowers.spawn(browser, [], async _ => {
    let iframe = content.document.createElement("iframe");
    iframe.src = "https://example.com";

    await new content.Promise(resolve => {
      iframe.onload = resolve;
      content.document.body.appendChild(iframe);
    });
  });

  // Get the last child entry in the session history for the same-origin iframe.
  let sh = browser.browsingContext.sessionHistory;
  let entry = sh.getEntryAtIndex(sh.count - 1);
  let childEntry = entry.GetChildAt(entry.childCount - 1);
  let partitionedPrincipalToInherit = childEntry.partitionedPrincipalToInherit;

  // Check that the partitioned principal to inherit is properly set.
  ok(partitionedPrincipalToInherit, "partitionedPrincipalToInherit is set");
  is(
    partitionedPrincipalToInherit.originNoSuffix,
    "https://example.com",
    "correct originNoSuffix in the same-origin iframe"
  );
  is(
    partitionedPrincipalToInherit.originAttributes.partitionKey,
    "(https,example.com)",
    "correct partitionKey in the same-origin iframe"
  );

  // Load a cross-site iframe.
  await SpecialPowers.spawn(browser, [], async _ => {
    let iframe = content.document.createElement("iframe");
    iframe.src = "https://example.net";

    await new content.Promise(resolve => {
      iframe.onload = resolve;
      content.document.body.appendChild(iframe);
    });
  });

  // Get the last child entry in the session history for the cross-site iframe.
  entry = sh.getEntryAtIndex(sh.count - 1);
  childEntry = entry.GetChildAt(entry.childCount - 1);
  partitionedPrincipalToInherit = childEntry.partitionedPrincipalToInherit;

  // Check that the partitioned principal to inherit is properly set.
  ok(partitionedPrincipalToInherit, "partitionedPrincipalToInherit is set");
  is(
    partitionedPrincipalToInherit.originNoSuffix,
    "https://example.net",
    "correct originNoSuffix in the cross-site iframe"
  );
  is(
    partitionedPrincipalToInherit.originAttributes.partitionKey,
    "(https,example.com)",
    "correct partitionKey in the cross-site iframe"
  );

  BrowserTestUtils.removeTab(tab);
});

add_task(async function test_partitioned_Principal_to_inherit_in_ABA_iframe() {
  // Create a new tab.
  let tab = await BrowserTestUtils.openNewForegroundTab(
    gBrowser,
    "https://example.com"
  );
  let browser = tab.linkedBrowser;

  // Load a ABA iframe
  await SpecialPowers.spawn(browser, [], async () => {
    let iframe = content.document.createElement("iframe");
    iframe.src = "https://example.net";

    await new content.Promise(resolve => {
      iframe.onload = resolve;
      content.document.body.appendChild(iframe);
    });

    await SpecialPowers.spawn(iframe, [], async () => {
      let nestedIframe = content.document.createElement("iframe");
      nestedIframe.src = "https://example.com";

      await new content.Promise(resolve => {
        nestedIframe.onload = resolve;
        content.document.body.appendChild(nestedIframe);
      });
    });
  });

  // Get the last child entry in the session history for the same-origin iframe.
  let sh = browser.browsingContext.sessionHistory;
  let entry = sh.getEntryAtIndex(sh.count - 1);
  let childEntry = entry.GetChildAt(entry.childCount - 1);
  let nestedChildEntry = childEntry.GetChildAt(childEntry.childCount - 1);
  let partitionedPrincipalToInherit =
    nestedChildEntry.partitionedPrincipalToInherit;

  // Check that the partitioned principal to inherit is properly set.
  ok(partitionedPrincipalToInherit, "partitionedPrincipalToInherit is set");
  is(
    partitionedPrincipalToInherit.originNoSuffix,
    "https://example.com",
    "correct originNoSuffix in the ABA iframe"
  );
  is(
    partitionedPrincipalToInherit.originAttributes.partitionKey,
    "(https,example.com,f)",
    "correct partitionKey in the ABA iframe"
  );

  BrowserTestUtils.removeTab(tab);
});
