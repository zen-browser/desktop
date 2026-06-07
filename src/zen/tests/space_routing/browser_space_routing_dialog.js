/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_setup(async function () {
  clearAllRoutes();
  const savedDefault = gZenSpaceRoutingManager.getDefaultExternalRoute();
  registerCleanupFunction(() => {
    clearAllRoutes();
    gZenSpaceRoutingManager.setDefaultExternalRoute(savedDefault);
  });
});

add_task(async function test_empty_placeholder_and_add_route() {
  clearAllRoutes();
  const dlg = await openRoutingDialog();
  try {
    const doc = dlg.document;
    const emptyText = doc.getElementById("sr-empty-content");
    const content = doc.getElementById("sr-content");

    Assert.notEqual(
      emptyText.style.display,
      "none",
      "The empty-state placeholder is visible when there are no routes"
    );

    doc.getElementById("sr-new-route").click();

    Assert.equal(
      content.querySelectorAll(".sr-rule-container").length,
      1,
      "Clicking 'New Route' injects one route element"
    );
    Assert.equal(
      emptyText.style.display,
      "none",
      "The empty-state placeholder is hidden once a route exists"
    );
    Assert.equal(
      gZenSpaceRoutingManager.getAllRoutes().length,
      1,
      "The new route is persisted into the manager"
    );
  } finally {
    await closeRoutingDialog(dlg);
    clearAllRoutes();
  }
});

add_task(async function test_remove_route_via_ui() {
  clearAllRoutes();
  addRoute({ reference: "github.com" });
  const dlg = await openRoutingDialog();
  try {
    const doc = dlg.document;
    Assert.equal(
      doc.querySelectorAll(".sr-rule-container").length,
      1,
      "Existing route is rendered on open"
    );

    doc.querySelector(".sr-remove").click();

    Assert.equal(
      doc.querySelectorAll(".sr-rule-container").length,
      0,
      "The route element is removed from the DOM"
    );
    Assert.equal(
      gZenSpaceRoutingManager.getAllRoutes().length,
      0,
      "The route is removed from the manager"
    );
    Assert.equal(
      doc.getElementById("sr-empty-content").style.display,
      "flex",
      "The empty-state placeholder returns after the last route is removed"
    );
  } finally {
    await closeRoutingDialog(dlg);
    clearAllRoutes();
  }
});

add_task(async function test_match_type_updates_placeholder_and_store() {
  clearAllRoutes();
  const route = addRoute({ reference: "", matchType: "contains" });
  const dlg = await openRoutingDialog();
  try {
    const doc = dlg.document;
    const menulist = doc.querySelector(".sr-rule-container .match-type-select");
    const input = doc.querySelector(".sr-rule-container .input");

    Assert.equal(
      input.placeholder,
      "zen-browser.app",
      "The 'contains' placeholder is the plain domain"
    );

    menulist.value = "regex";
    menulist.dispatchEvent(new Event("command", { bubbles: true }));

    Assert.equal(
      input.placeholder,
      "zen-browser\\.app",
      "Switching to 'regex' updates the placeholder to an escaped pattern"
    );
    Assert.equal(
      gZenSpaceRoutingManager.getRoute(route.id).matchType,
      "regex",
      "The match type change is persisted to the manager"
    );
  } finally {
    await closeRoutingDialog(dlg);
    clearAllRoutes();
  }
});

add_task(async function test_invalid_regex_is_flagged_and_not_saved() {
  clearAllRoutes();
  const route = addRoute({ reference: "", matchType: "regex" });
  const dlg = await openRoutingDialog();
  try {
    const doc = dlg.document;
    const input = doc.querySelector(".sr-rule-container .input");

    input.value = "([";
    input.dispatchEvent(new Event("input", { bubbles: true }));

    ok(
      input.classList.contains("invalid"),
      "An invalid regex marks the input as invalid"
    );
    Assert.equal(
      gZenSpaceRoutingManager.getRoute(route.id).reference,
      "",
      "An invalid regex is NOT written to the route"
    );

    input.value = "zen.*app";
    input.dispatchEvent(new Event("input", { bubbles: true }));

    ok(
      !input.classList.contains("invalid"),
      "A subsequently valid regex clears the invalid state"
    );
    Assert.equal(
      gZenSpaceRoutingManager.getRoute(route.id).reference,
      "zen.*app",
      "A valid regex is written to the route"
    );
  } finally {
    await closeRoutingDialog(dlg);
    clearAllRoutes();
  }
});

add_task(async function test_default_external_select_updates_store() {
  clearAllRoutes();
  await gZenWorkspaces.promiseInitialized;
  gZenSpaceRoutingManager.setDefaultExternalRoute("most-recent-space");

  const dlg = await openRoutingDialog();
  try {
    const doc = dlg.document;
    const select = doc.getElementById("sr-default-external-open-in");

    await TestUtils.waitForCondition(
      () => select.querySelectorAll("menuitem").length > 1,
      "External-default options were populated"
    );

    const workspaceUuid = gZenWorkspaces.getWorkspaces()[0].uuid;
    select.value = workspaceUuid;
    select.dispatchEvent(new Event("command", { bubbles: true }));

    Assert.equal(
      gZenSpaceRoutingManager.getDefaultExternalRoute(),
      workspaceUuid,
      "Changing the external-default select updates the manager"
    );
  } finally {
    await closeRoutingDialog(dlg);
    gZenSpaceRoutingManager.setDefaultExternalRoute("most-recent-space");
  }
});

add_task(async function test_routes_are_saved_on_close() {
  clearAllRoutes();
  const dlg = await openRoutingDialog();

  let saveCalls = 0;
  const realSave = gZenSpaceRoutingManager.saveRoutes;
  gZenSpaceRoutingManager.saveRoutes = function () {
    saveCalls++;
    return realSave.call(this);
  };

  try {
    const closed = BrowserTestUtils.domWindowClosed(dlg);
    dlg.close();
    await TestUtils.waitForCondition(
      () => saveCalls > 0,
      "Closing the dialog flushes routes to disk via saveRoutes()"
    );
    await closed;
  } finally {
    delete gZenSpaceRoutingManager.saveRoutes;
  }
});

add_task(async function test_open_broadcasts_kill_to_other_instances() {
  clearAllRoutes();

  let killNotified = false;
  const observer = {
    observe(_subject, topic) {
      if (topic === "zen-space-routing-kill") {
        killNotified = true;
      }
    },
  };
  Services.obs.addObserver(observer, "zen-space-routing-kill");

  let dlg;
  try {
    dlg = await openRoutingDialog();
    ok(
      killNotified,
      "Opening a dialog broadcasts 'zen-space-routing-kill' so others can close"
    );
  } finally {
    Services.obs.removeObserver(observer, "zen-space-routing-kill");
    if (dlg) {
      await closeRoutingDialog(dlg);
    }
  }
});

add_task(async function test_kill_notification_closes_dialog() {
  clearAllRoutes();
  const dlg = await openRoutingDialog();

  const closed = BrowserTestUtils.domWindowClosed(dlg);
  Services.obs.notifyObservers(null, "zen-space-routing-kill");
  await closed;

  ok(dlg.closed, "A 'zen-space-routing-kill' notification closes the dialog");
});
