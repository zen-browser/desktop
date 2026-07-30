/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const { ZenWorkspaceCommandLineHandler } = ChromeUtils.importESModule(
  "resource:///modules/zen/ZenWorkspaceCommandLine.sys.mjs"
);

const TEST_URL = "https://example.com/";
const TARGET_SPACE_NAME = "CLI Target Space";

/**
 * Minimal stand-in for nsICommandLine. Flags are consumed on first read, the
 * same way the real implementation behaves, so a handler that reads a flag
 * twice would be caught here.
 *
 * @param {object} flags - Map of flag name to value, e.g. { workspace: "Work" }
 * @returns {object} A fake command line
 */
function makeFakeCommandLine(flags = {}) {
  const remaining = { ...flags };
  return {
    preventDefault: false,
    handleFlagWithParam(flag) {
      if (!(flag in remaining)) {
        return null;
      }
      const value = remaining[flag];
      delete remaining[flag];
      return value;
    },
    handleFlag(flag) {
      const present = flag in remaining;
      delete remaining[flag];
      return present;
    },
    resolveURI(spec) {
      return Services.io.newURI(spec);
    },
  };
}

/**
 * A window that records what the handler asks of it, so the error paths can be
 * checked without touching the real tab strip.
 *
 * @param {object[]} spaces - The spaces the fake window knows about
 * @returns {object} A fake browser window
 */
function makeFakeWindow(spaces = []) {
  return {
    gBrowser: {
      addTabCalls: [],
      addTab(uriString, options) {
        this.addTabCalls.push({ uriString, options });
        return {};
      },
    },
    gZenWorkspaces: {
      workspaceEnabled: true,
      moveCalls: [],
      lastSelectedWorkspaceTabs: {},
      getWorkspaces() {
        return spaces;
      },
      moveTabToWorkspace(tab, uuid) {
        this.moveCalls.push({ tab, uuid });
      },
    },
  };
}

/**
 * Builds a handler pointed at the given window, recording every reported
 * error instead of writing it to the console.
 *
 * @param {object|null} win - The window the handler should target
 * @returns {object} { handler, errors }
 */
function makeHandler(win) {
  const handler = new ZenWorkspaceCommandLineHandler();
  const errors = [];
  handler.getTargetWindow = () => win;
  handler.reportError = message => {
    errors.push(message);
  };
  return { handler, errors };
}

add_task(async function test_opens_tab_in_named_non_active_space() {
  const originalUuid = gZenWorkspaces.activeWorkspace;
  const target = await gZenWorkspaces.createAndSaveWorkspace(TARGET_SPACE_NAME);

  // createAndSaveWorkspace() switches to the space it just made, so go back:
  // the point of the flag is to target a space that is *not* active.
  await gZenWorkspaces.changeWorkspaceWithID(originalUuid);
  Assert.strictEqual(
    gZenWorkspaces.activeWorkspace,
    originalUuid,
    "The target space is not the active one"
  );

  const { handler, errors } = makeHandler(window);
  const cmdLine = makeFakeCommandLine({
    workspace: TARGET_SPACE_NAME,
    "new-tab": TEST_URL,
  });

  const tabsBefore = new Set(gBrowser.tabs);
  handler.handle(cmdLine);
  const newTabs = Array.from(gBrowser.tabs).filter(t => !tabsBefore.has(t));

  Assert.deepEqual(errors, [], "No error was reported");
  Assert.strictEqual(newTabs.length, 1, "Exactly one tab was opened");
  Assert.strictEqual(
    newTabs[0].getAttribute("zen-workspace-id"),
    target.uuid,
    "The tab belongs to the space named on the command line"
  );
  Assert.strictEqual(
    gZenWorkspaces.activeWorkspace,
    originalUuid,
    "The active space did not change"
  );
  Assert.notStrictEqual(
    gBrowser.selectedTab,
    newTabs[0],
    "The tab opened in the background"
  );
  Assert.ok(
    cmdLine.preventDefault,
    "Default command line handling was stopped"
  );

  BrowserTestUtils.removeTab(newTabs[0]);
  await gZenWorkspaces.removeWorkspace(target.uuid);
});

add_task(function test_unknown_space_name_fails_loudly() {
  const win = makeFakeWindow([
    { uuid: "uuid-1", name: "Work", containerTabId: 0 },
  ]);
  const { handler, errors } = makeHandler(win);
  const cmdLine = makeFakeCommandLine({
    workspace: "Nope",
    "new-tab": TEST_URL,
  });

  handler.handle(cmdLine);

  Assert.strictEqual(errors.length, 1, "Exactly one error was reported");
  Assert.ok(
    errors[0].includes("Nope"),
    `The error names the space that was asked for: ${errors[0]}`
  );
  Assert.ok(
    errors[0].includes("Work"),
    `The error lists the spaces that do exist: ${errors[0]}`
  );
  Assert.deepEqual(
    win.gBrowser.addTabCalls,
    [],
    "No tab was opened, so the URL did not silently land in the active space"
  );
  Assert.deepEqual(win.gZenWorkspaces.moveCalls, [], "No tab was moved");
});

add_task(function test_duplicate_names_use_the_first_match() {
  const win = makeFakeWindow([
    { uuid: "uuid-1", name: "Twin", containerTabId: 3 },
    { uuid: "uuid-2", name: "Twin", containerTabId: 4 },
  ]);
  const { handler, errors } = makeHandler(win);

  handler.handle(
    makeFakeCommandLine({ workspace: "Twin", "new-tab": TEST_URL })
  );

  Assert.deepEqual(errors, [], "A duplicated name is not an error");
  Assert.strictEqual(win.gBrowser.addTabCalls.length, 1, "One tab was opened");
  Assert.strictEqual(
    win.gBrowser.addTabCalls[0].options.userContextId,
    3,
    "The tab uses the container of the first matching space"
  );
  Assert.strictEqual(
    win.gZenWorkspaces.moveCalls[0].uuid,
    "uuid-1",
    "The tab went to the first space with that name"
  );
});

add_task(function test_workspace_without_new_tab_fails_loudly() {
  const win = makeFakeWindow([
    { uuid: "uuid-1", name: "Work", containerTabId: 0 },
  ]);
  const { handler, errors } = makeHandler(win);
  const cmdLine = makeFakeCommandLine({ workspace: "Work" });

  handler.handle(cmdLine);

  Assert.strictEqual(errors.length, 1, "Exactly one error was reported");
  Assert.ok(
    errors[0].includes("--new-tab"),
    `The error says which flag is missing: ${errors[0]}`
  );
  Assert.deepEqual(win.gBrowser.addTabCalls, [], "No tab was opened");
  Assert.ok(
    !cmdLine.preventDefault,
    "Startup is left alone when there was nothing to open"
  );
});

// The handler is registered ahead of Firefox's own, so it runs on every launch.
// Without --workspace it has to be completely inert: no flag consumed, no
// preventDefault, nothing asked of the window.
add_task(function test_without_workspace_flag_nothing_is_touched() {
  const win = makeFakeWindow([
    { uuid: "uuid-1", name: "Work", containerTabId: 0 },
  ]);
  const { handler, errors } = makeHandler(win);
  const cmdLine = makeFakeCommandLine({
    "new-tab": TEST_URL,
    "new-window": TEST_URL,
    "private-window": TEST_URL,
    url: TEST_URL,
  });

  handler.handle(cmdLine);

  Assert.deepEqual(errors, [], "Nothing was reported");
  Assert.ok(!cmdLine.preventDefault, "Default handling was left alone");
  Assert.deepEqual(win.gBrowser.addTabCalls, [], "No tab was opened");
  Assert.strictEqual(
    cmdLine.handleFlagWithParam("new-tab"),
    TEST_URL,
    "--new-tab is still there for the default handler"
  );
  Assert.strictEqual(
    cmdLine.handleFlagWithParam("new-window"),
    TEST_URL,
    "--new-window is untouched"
  );
  Assert.strictEqual(
    cmdLine.handleFlagWithParam("private-window"),
    TEST_URL,
    "--private-window is untouched"
  );
  Assert.strictEqual(
    cmdLine.handleFlagWithParam("url"),
    TEST_URL,
    "-url is untouched"
  );
});

add_task(function test_no_arguments_at_all_is_inert() {
  const { handler, errors } = makeHandler(makeFakeWindow());
  const cmdLine = makeFakeCommandLine();

  handler.handle(cmdLine);

  Assert.deepEqual(errors, [], "A bare launch reports nothing");
  Assert.ok(!cmdLine.preventDefault, "A bare launch is not interfered with");
});

add_task(function test_no_browser_window_fails_loudly() {
  const { handler, errors } = makeHandler(null);

  handler.handle(
    makeFakeCommandLine({ workspace: "Work", "new-tab": TEST_URL })
  );

  Assert.strictEqual(errors.length, 1, "Exactly one error was reported");
});
