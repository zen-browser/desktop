/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const { commitOnSpace, parseMarkdown, parseNoteURL, serializeMarkdown } =
  ChromeUtils.importESModule("resource:///modules/zen/notepad/ZenNotepadMarkdown.mjs");
const { loadNote, notesDirectory } = ChromeUtils.importESModule(
  "resource:///modules/zen/notepad/ZenNotepadStore.sys.mjs"
);

/* eslint-disable mozilla/no-arbitrary-setTimeout */

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function notepad(tab = gBrowser.selectedTab) {
  return SpecialPowers.spawn(tab.linkedBrowser, [], () => {
    const note = content.wrappedJSObject.MintNotepad;
    if (!note?.ready) {
      return null;
    }
    return {
      ready: true,
      text: note.text(),
      lineType: note.lineType(),
      menuOpen: note.menuOpen(),
      selectedCommand: note.selectedCommand(),
      armed: note.armed(),
      pageTitle: note.pageTitle(),
    };
  });
}

async function openNote(url = "mint://note") {
  const tab = await BrowserTestUtils.openNewForegroundTab(gBrowser, "about:blank");
  const browser = tab.linkedBrowser;
  const loaded = BrowserTestUtils.browserLoaded(browser, false, next =>
    next.startsWith("mint:")
  );
  BrowserTestUtils.startLoadingURIString(browser, url);
  let opened = false;
  try {
    await loaded;
    opened = true;
  } catch (error) {
    info(`notepad load failed: ${error}`);
  }
  const ready =
    opened &&
    (await TestUtils.waitForCondition(
      async () => (await notepad(tab))?.ready,
      "notepad became ready"
    ).catch(() => false));
  if (!ready) {
    const spec = browser.currentURI?.spec;
    BrowserTestUtils.removeTab(tab);
    throw new Error(`notepad did not open (${spec}, remote=${browser.isRemoteBrowser})`);
  }
  ok(browser.currentURI.spec.startsWith(url), `address is ${browser.currentURI.spec}`);
  ok(gURLBar.value.includes("mint://note"), `url bar shows ${gURLBar.value}`);
  return tab;
}

async function focusEditor(tab, { append = false } = {}) {
  await SpecialPowers.spawn(tab.linkedBrowser, [append], appendCaret => {
    const editorNode = content.document.getElementById("mint-note-editor");
    editorNode.focus();
    if (!appendCaret) {
      return;
    }
    const line = editorNode.querySelector(".mint-line:last-child") || editorNode;
    const selection = content.getSelection();
    selection.selectAllChildren(line);
    selection.collapseToEnd();
  });
}

async function typeText(text, tab = gBrowser.selectedTab, { append = false } = {}) {
  await focusEditor(tab, { append });
  for (const char of text) {
    await BrowserTestUtils.synthesizeKey(char, {}, tab.linkedBrowser);
  }
}

async function pressKey(key, tab = gBrowser.selectedTab) {
  await focusEditor(tab);
  await BrowserTestUtils.synthesizeKey(key, {}, tab.linkedBrowser);
}

async function clickNoteButton(tab, id) {
  await SpecialPowers.spawn(tab.linkedBrowser, [id], buttonId => {
    content.document.getElementById(buttonId).click();
  });
}

async function clearNotes() {
  if (await IOUtils.exists(notesDirectory())) {
    await IOUtils.remove(notesDirectory(), { recursive: true });
  }
}

async function closeNoteTabs() {
  for (const tab of [...gBrowser.tabs]) {
    if (tab.linkedBrowser?.currentURI?.schemeIs("mint")) {
      BrowserTestUtils.removeTab(tab);
    }
  }
}

registerCleanupFunction(async () => {
  Services.prefs.clearUserPref("zen.notepad.autocomplete-key");
  Services.prefs.clearUserPref("zen.notepad.test.export-path");
  await closeNoteTabs();
  await clearNotes();
});

add_task(function test_mint_sets_one_security_flag() {
  const handler = Ci.nsIProtocolHandler;
  const flags = Services.io.getProtocolFlags("mint");
  const set = [
    handler.URI_LOADABLE_BY_ANYONE,
    handler.URI_DANGEROUS_TO_LOAD,
    handler.URI_IS_UI_RESOURCE,
    handler.URI_IS_LOCAL_FILE,
    handler.URI_LOADABLE_BY_SUBSUMERS,
    handler.URI_IS_WEBEXTENSION_RESOURCE,
  ].filter(flag => flags & flag);
  Assert.equal(set.length, 1, "Gecko blocks loads of schemes with several security flags");
});

add_task(async function test_markdown_model() {
  Assert.equal(commitOnSpace({ type: "paragraph", text: "##" }).type, "h2");
  Assert.equal(commitOnSpace({ type: "paragraph", text: "hello" }), null);
  const lines = parseMarkdown("## Title\n\n- item\n");
  Assert.equal(lines[0].type, "h2");
  Assert.equal(lines[0].text, "Title");
  Assert.equal(lines[2].type, "bullet");
  Assert.equal(serializeMarkdown(lines).split("\n")[0], "## Title");
  Assert.deepEqual(parseNoteURL("mint://note"), { id: null });
  Assert.equal(parseNoteURL("mint://other"), null);
});

add_task(async function test_tabs_are_independent() {
  const first = await openNote();
  await typeText("alpha", first);
  const second = await openNote();
  await typeText("beta", second);
  Assert.equal((await notepad(second)).text, "beta");
  Assert.equal((await notepad(first)).text, "alpha");
  BrowserTestUtils.removeTab(second);
  BrowserTestUtils.removeTab(first);
});

add_task(async function test_space_makes_heading() {
  const tab = await openNote();
  await typeText("##", tab);
  await pressKey(" ", tab);
  await TestUtils.waitForCondition(
    async () => (await notepad(tab)).lineType === "h2",
    "space after ## becomes heading 2"
  );
  Assert.equal((await notepad(tab)).text, "## ");
  BrowserTestUtils.removeTab(tab);
});

add_task(async function test_tab_confirms_autocomplete() {
  Services.prefs.setStringPref("zen.notepad.autocomplete-key", "Tab");
  const tab = await openNote();
  await typeText("#", tab);
  await TestUtils.waitForCondition(async () => (await notepad(tab)).menuOpen, "menu opened");
  Assert.equal((await notepad(tab)).selectedCommand, "h1");
  await pressKey("KEY_Tab", tab);
  await TestUtils.waitForCondition(
    async () => (await notepad(tab)).lineType === "h1",
    "Tab confirms heading 1"
  );
  BrowserTestUtils.removeTab(tab);
});

add_task(async function test_confirm_shortcut_is_configurable() {
  Services.prefs.setStringPref("zen.notepad.autocomplete-key", "F8");
  const tab = await openNote();
  await typeText("#", tab);
  await TestUtils.waitForCondition(async () => (await notepad(tab)).menuOpen, "menu opened");
  await pressKey("KEY_Tab", tab);
  Assert.equal((await notepad(tab)).lineType, "paragraph", "Tab does not confirm");
  BrowserTestUtils.removeTab(tab);

  const configured = await openNote();
  await typeText("#", configured);
  await TestUtils.waitForCondition(
    async () => (await notepad(configured)).menuOpen,
    "menu opened for the configured key"
  );
  await pressKey("KEY_F8", configured);
  await TestUtils.waitForCondition(
    async () => (await notepad(configured)).lineType === "h1",
    "F8 confirms when configured"
  );
  BrowserTestUtils.removeTab(configured);
  Services.prefs.setStringPref("zen.notepad.autocomplete-key", "Tab");
});

add_task(async function test_save_is_encrypted_and_reloads() {
  await clearNotes();
  const tab = await openNote();
  await typeText("Secret note", tab);
  await clickNoteButton(tab, "mint-note-save");
  await TestUtils.waitForCondition(async () => (await notepad(tab)).armed, "save armed autosave");
  const id = parseNoteURL(tab.linkedBrowser.currentURI.spec).id;
  ok(id, "save assigns a note address");
  const raw = await IOUtils.readUTF8(PathUtils.join(notesDirectory(), `${id}.note`));
  ok(!raw.includes("Secret note"), "saved file is not plaintext");
  Assert.equal((await loadNote(id)).markdown, "Secret note");

  const reloaded = await openNote(`mint://note/${id}`);
  Assert.equal((await notepad(reloaded)).text, "Secret note");
  Assert.ok((await notepad(reloaded)).armed, "reopened note keeps autosave");
  BrowserTestUtils.removeTab(reloaded);
  BrowserTestUtils.removeTab(tab);
});

add_task(async function test_autosave_waits_for_first_save_then_pauses() {
  await clearNotes();
  const tab = await openNote();
  await typeText("one", tab);
  await wait(1200);
  if (await IOUtils.exists(notesDirectory())) {
    const children = await IOUtils.getChildren(notesDirectory());
    ok(
      !children.some(path => path.endsWith(".note")),
      "typing before Save does not write a note"
    );
  }
  ok(!(await notepad(tab)).armed, "autosave stays off");

  await clickNoteButton(tab, "mint-note-save");
  await TestUtils.waitForCondition(async () => (await notepad(tab)).armed, "first save");
  const id = parseNoteURL(tab.linkedBrowser.currentURI.spec).id;
  await typeText(" two", tab, { append: true });
  await TestUtils.waitForCondition(
    async () => (await loadNote(id)).markdown === "one two",
    "autosave writes one second after typing pauses"
  );
  BrowserTestUtils.removeTab(tab);
});

add_task(async function test_rename_title_persists() {
  await clearNotes();
  const tab = await openNote();
  await typeText("Body text", tab);
  await SpecialPowers.spawn(tab.linkedBrowser, [], () => {
    const title = content.document.getElementById("mint-note-title");
    title.dispatchEvent(
      new content.MouseEvent("dblclick", { bubbles: true, cancelable: true })
    );
    title.focus();
  });
  for (const char of "My note") {
    await BrowserTestUtils.synthesizeKey(char, {}, tab.linkedBrowser);
  }
  await BrowserTestUtils.synthesizeKey("KEY_Enter", {}, tab.linkedBrowser);
  await TestUtils.waitForCondition(
    async () => (await notepad(tab)).pageTitle === "My note",
    "custom title is shown"
  );
  await clickNoteButton(tab, "mint-note-save");
  await TestUtils.waitForCondition(async () => (await notepad(tab)).armed, "save armed autosave");
  const id = parseNoteURL(tab.linkedBrowser.currentURI.spec).id;
  Assert.equal((await loadNote(id)).title, "My note");

  const reloaded = await openNote(`mint://note/${id}`);
  Assert.equal((await notepad(reloaded)).pageTitle, "My note");
  Assert.equal((await notepad(reloaded)).text, "Body text");
  BrowserTestUtils.removeTab(reloaded);
  BrowserTestUtils.removeTab(tab);
});

add_task(async function test_export_writes_markdown_without_autosave() {
  await clearNotes();
  const destination = PathUtils.join(PathUtils.tempDir, `mint-note-${Date.now()}.md`);
  Services.prefs.setStringPref("zen.notepad.test.export-path", destination);
  const tab = await openNote();
  await typeText("export me", tab);
  await clickNoteButton(tab, "mint-note-export");
  await TestUtils.waitForCondition(
    async () => (await IOUtils.exists(destination)) && (await IOUtils.readUTF8(destination)) === "export me",
    "export writes the markdown file"
  );
  await wait(1200);
  ok(!(await notepad(tab)).armed, "export does not arm autosave");
  if (await IOUtils.exists(notesDirectory())) {
    const children = await IOUtils.getChildren(notesDirectory());
    ok(!children.some(path => path.endsWith(".note")), "export does not save in the app");
  }
  await IOUtils.remove(destination);
  BrowserTestUtils.removeTab(tab);
});
