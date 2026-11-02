/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

ChromeUtils.defineESModuleGetters(this, {
  sinon: "resource://testing-common/Sinon.sys.mjs",
});

const PREF_WARN = "browser.tabs.warnOnCloseOtherTabs";
const PREF_MAX_UNDO = "browser.sessionstore.max_tabs_undo";

let sandbox;

add_setup(function () {
  sandbox = sinon.createSandbox();
  registerCleanupFunction(() => sandbox.restore());
});

function dismissWarning(accept) {
  return new Promise(resolve => {
    Services.obs.addObserver(function observer(subject) {
      Services.obs.removeObserver(observer, "common-dialog-loaded");
      const dialog = subject.document.getElementById("commonDialog");
      if (accept) {
        dialog.acceptDialog();
      } else {
        dialog.cancelDialog();
      }
      resolve(true);
    }, "common-dialog-loaded");
  });
}

async function withWorkspaceOfTabs(count, taskFn) {
  const workspace = await gZenWorkspaces.createAndSaveWorkspace("Closable");
  await gZenWorkspaces.changeWorkspace(workspace);

  const tabs = [];
  for (let i = 0; i < count; i++) {
    tabs.push(
      await BrowserTestUtils.openNewForegroundTab(
        gBrowser,
        `data:text/html,<title>Closable ${i}</title>`,
        true,
        { skipAnimation: true }
      )
    );
  }
  const selected = tabs.at(-1);
  const closable = tabs.filter(tab => tab !== selected);

  try {
    await taskFn({ tabs, closable, selected });
  } finally {
    for (const tab of tabs) {
      if (tab.isConnected) {
        gBrowser.removeTab(tab, { skipAnimation: true });
      }
    }
    await gZenWorkspaces.removeWorkspace(workspace.uuid);
  }
}

add_task(async function test_warns_about_the_closable_tabs() {
  await SpecialPowers.pushPrefEnv({
    set: [
      [PREF_WARN, true],
      [PREF_MAX_UNDO, 1],
    ],
  });

  await withWorkspaceOfTabs(3, async ({ closable }) => {
    const warn = sandbox.spy(gBrowser, "warnAboutClosingTabs");

    const dismissed = dismissWarning(false);
    await gZenWorkspaces.closeAllUnpinnedTabs();
    ok(await dismissed, "The warning was shown");

    sinon.assert.calledOnce(warn);
    Assert.deepEqual(
      warn.firstCall.args,
      [closable.length, window.Tabbrowser.closingTabsEnum.OTHER],
      "Warns about every closable tab, as a partial close"
    );

    warn.restore();
  });

  await SpecialPowers.popPrefEnv();
});

add_task(async function test_cancelling_the_warning_keeps_the_tabs() {
  await SpecialPowers.pushPrefEnv({
    set: [
      [PREF_WARN, true],
      [PREF_MAX_UNDO, 1],
    ],
  });

  await withWorkspaceOfTabs(3, async ({ tabs, closable }) => {
    const showToast = sandbox.stub(gZenUIManager, "showToast");

    const dismissed = dismissWarning(false);
    await gZenWorkspaces.closeAllUnpinnedTabs();
    ok(await dismissed, "The warning was shown");

    for (const tab of tabs) {
      ok(tab.isConnected, "Tab survives a cancelled warning");
      ok(!tab.closing, "Tab is not on its way out");
    }
    Assert.equal(
      closable.length,
      2,
      "The cancelled close really had more than one tab to close"
    );
    ok(
      !showToast.called,
      "No 'closed all unpinned tabs' toast for a cancelled warning"
    );

    showToast.restore();
  });

  await SpecialPowers.popPrefEnv();
});

add_task(async function test_accepting_the_warning_closes_the_tabs() {
  await SpecialPowers.pushPrefEnv({
    set: [
      [PREF_WARN, true],
      [PREF_MAX_UNDO, 1],
    ],
  });

  await withWorkspaceOfTabs(3, async ({ closable, selected }) => {
    const dismissed = dismissWarning(true);
    await gZenWorkspaces.closeAllUnpinnedTabs();
    ok(await dismissed, "The warning was shown");

    await TestUtils.waitForCondition(
      () => closable.every(tab => !tab.isConnected),
      "Every closable tab goes away once the warning is accepted"
    );
    ok(selected.isConnected, "The selected tab is kept");
  });

  await SpecialPowers.popPrefEnv();
});

add_task(async function test_no_warning_while_the_tabs_are_restorable() {
  await SpecialPowers.pushPrefEnv({
    set: [
      [PREF_WARN, true],
      [PREF_MAX_UNDO, 10],
    ],
  });

  await withWorkspaceOfTabs(3, async ({ closable }) => {
    let dialogShown = false;
    const observer = () => {
      dialogShown = true;
    };
    Services.obs.addObserver(observer, "common-dialog-loaded");

    try {
      await gZenWorkspaces.closeAllUnpinnedTabs();
      ok(!dialogShown, "Restorable tabs close without a warning");
      await TestUtils.waitForCondition(
        () => closable.every(tab => !tab.isConnected),
        "The tabs close anyway"
      );
    } finally {
      Services.obs.removeObserver(observer, "common-dialog-loaded");
    }
  });

  await SpecialPowers.popPrefEnv();
});
