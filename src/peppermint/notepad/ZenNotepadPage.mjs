/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import {
  autocompleteMatches,
  commandResult,
  commitOnSpace,
  eventMatchesShortcut,
  exportFileName,
  inlineRanges,
  noteTitle,
  noteURL,
  parseMarkdown,
  parseNoteURL,
  serializeMarkdown,
} from "resource:///modules/zen/notepad/ZenNotepadMarkdown.mjs";
const SHORTCUT_PREF = "zen.notepad.autocomplete-key";
const AUTOSAVE_MS = 1000;
const DEFAULT_TITLE_L10N = "zen-notepad-title";
const RENAME_TITLE_TOOLTIP = "Double-click to rename";

const COMMAND_LABELS = {
  h1: "Heading 1",
  h2: "Heading 2",
  h3: "Heading 3",
  h4: "Heading 4",
  h5: "Heading 5",
  h6: "Heading 6",
  bullet: "Bulleted list",
  numbered: "Numbered list",
  quote: "Quote",
  code: "Code block",
  task: "Task",
  hr: "Horizontal rule",
  link: "Link",
  image: "Image",
  bold: "Bold",
  strike: "Strikethrough",
  "inline-code": "Inline code",
};

const STATUS_TEXT = {
  unsaved: "Unsaved",
  saving: "Saving…",
  saved: "Saved",
  error: "Could not save",
};


export async function attachNotepad(document_, bridge_) {
  if (document_.documentElement?.dataset.mintNotepad === "ready") {
    return;
  }
  const doc = document_;
  const view = doc.defaultView;
  const bridge = bridge_;
  const editor = doc.getElementById("mint-note-editor");
  const gutter = doc.getElementById("mint-note-gutter");
  const menu = doc.getElementById("mint-note-menu");
  const statusNode = doc.getElementById("mint-note-status");
  const saveButton = doc.getElementById("mint-note-save");
  const exportButton = doc.getElementById("mint-note-export");
  const titleEl = doc.getElementById("mint-note-title");
  if (!editor || !saveButton || !menu) {
    return;
  }
  const state = {
    id: null,
    armed: false,
    dirty: false,
    saving: null,
    saveAgain: false,
    timer: 0,
    ready: false,
    menuItems: [],
    menuIndex: 0,
    customTitle: null,
    editingTitle: false,
  };
  const highlights = {};
  try {
    if (typeof view.Highlight === "function" && view.CSS?.highlights) {
      for (const kind of ["bold", "italic", "strike", "code", "link", "image"]) {
        highlights[kind] = new view.Highlight();
        view.CSS.highlights.set("md-" + kind, highlights[kind]);
      }
    }
  } catch (error) {
    console.error("Notepad highlights unavailable", error);
  }

  function shortcutSpec() {
    return Services.prefs.getStringPref(SHORTCUT_PREF, "Tab");
  }

  function setStatus(name) {
    statusNode.dataset.state = name;
    statusNode.textContent = STATUS_TEXT[name] || "";
    const l10nId = {
      unsaved: "zen-notepad-status-unsaved",
      saving: "zen-notepad-status-saving",
      saved: "zen-notepad-status-saved",
      error: "zen-notepad-status-error",
    }[name];
    if (l10nId && doc.l10n) {
      doc.l10n.setAttributes(statusNode, l10nId);
    }
  }

  function createLine(line) {
    const element = doc.createElement("div");
    element.className = "mint-line";
    element.dataset.type = line.type || "paragraph";
    if (line.type === "hr") {
      element.contentEditable = "false";
      element.appendChild(doc.createElement("hr"));
      return element;
    }
    if (line.type === "numbered") {
      element.dataset.start = String(line.start || 1);
    }
    if (line.type === "task") {
      element.dataset.checked = line.checked ? "true" : "false";
      const button = doc.createElement("button");
      button.type = "button";
      button.className = "mint-task";
      button.contentEditable = "false";
      button.setAttribute("aria-pressed", line.checked ? "true" : "false");
      element.appendChild(button);
    }
    if (line.text) {
      element.appendChild(doc.createTextNode(line.text));
    } else {
      element.appendChild(doc.createElement("br"));
    }
    return element;
  }

  function render(lines) {
    editor.replaceChildren(...lines.map(createLine));
    refreshGutter();
    paintHighlights();
    updateTitle();
  }

  function lineText(line) {
    if (!line || line.dataset.type === "hr") {
      return "";
    }
    let text = "";
    for (const node of line.childNodes) {
      if (node.nodeType === Node.TEXT_NODE) {
        text += node.data;
      }
    }
    return text;
  }

  function setLineText(line, text) {
    const button = line.querySelector(".mint-task");
    const preserved = button ? button.cloneNode(true) : null;
    line.replaceChildren();
    if (preserved) {
      line.appendChild(preserved);
    }
    if (text) {
      line.appendChild(doc.createTextNode(text));
    } else if (line.dataset.type !== "hr") {
      line.appendChild(doc.createElement("br"));
    }
  }

  function readLines() {
    return [...editor.querySelectorAll(".mint-line")].map(line => ({
      type: line.dataset.type || "paragraph",
      text: lineText(line),
      checked: line.dataset.checked === "true",
      start: Number(line.dataset.start || 1),
    }));
  }

  function currentLine() {
    const selection = view.getSelection();
    if (!selection?.rangeCount) {
      return editor.querySelector(".mint-line");
    }
    let node = selection.anchorNode;
    if (node === editor) {
      const lines = editor.querySelectorAll(".mint-line");
      return lines[selection.anchorOffset] || lines[0] || null;
    }
    while (node && node !== editor) {
      if (node.classList?.contains("mint-line")) {
        return node;
      }
      node = node.parentNode;
    }
    return editor.querySelector(".mint-line");
  }

  function caretOffset(line) {
    const selection = view.getSelection();
    if (!selection?.rangeCount || !line.contains(selection.anchorNode)) {
      return 0;
    }
    const range = doc.createRange();
    range.selectNodeContents(line);
    range.setEnd(selection.anchorNode, selection.anchorOffset);
    return range.toString().length;
  }

  function placeCaret(line, offset) {
    const selection = view.getSelection();
    const range = doc.createRange();
    let remaining = offset;
    for (const node of line.childNodes) {
      if (node.nodeType !== Node.TEXT_NODE) {
        continue;
      }
      if (remaining <= node.length) {
        range.setStart(node, remaining);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
        return;
      }
      remaining -= node.length;
    }
    range.selectNodeContents(line);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  function applyBlock(line, result, remainder) {
    const next = line.nextElementSibling;
    line.contentEditable = result.type === "hr" ? "false" : "true";
    line.dataset.type = result.type;
    delete line.dataset.start;
    delete line.dataset.checked;
    line.querySelector(".mint-task")?.remove();
    if (result.type === "hr") {
      line.replaceChildren(doc.createElement("hr"));
      let following = next;
      if (!following) {
        following = createLine({ type: "paragraph", text: "" });
        line.after(following);
      }
      placeCaret(following, 0);
      return;
    }
    if (result.type === "numbered") {
      line.dataset.start = String(result.start || 1);
    }
    if (result.type === "task") {
      line.dataset.checked = result.checked ? "true" : "false";
      const button = doc.createElement("button");
      button.type = "button";
      button.className = "mint-task";
      button.contentEditable = "false";
      button.setAttribute("aria-pressed", result.checked ? "true" : "false");
      line.appendChild(button);
    }
    setLineText(line, remainder);
    if (result.type === "task" && !line.querySelector(".mint-task")) {
      const button = doc.createElement("button");
      button.type = "button";
      button.className = "mint-task";
      button.contentEditable = "false";
      line.prepend(button);
    }
    placeCaret(line, 0);
  }

  function tryCommitSpace() {
    const line = currentLine();
    if (!line) {
      return false;
    }
    const text = lineText(line);
    const offset = caretOffset(line);
    if (text.slice(offset).length) {
      return false;
    }
    const result = commitOnSpace({ type: line.dataset.type, text: text.slice(0, offset) });
    if (!result) {
      return false;
    }
    applyBlock(line, result, "");
    closeMenu();
    return true;
  }

  function splitLine() {
    const line = currentLine();
    if (!line) {
      return;
    }
    if (line.dataset.type === "hr") {
      const created = createLine({ type: "paragraph", text: "" });
      line.after(created);
      placeCaret(created, 0);
      return;
    }
    const text = lineText(line);
    const offset = caretOffset(line);
    const before = text.slice(0, offset);
    const after = text.slice(offset);
    const type = line.dataset.type;
    if (
      (type === "bullet" || type === "numbered" || type === "task" || type === "quote") &&
      before === "" &&
      after === ""
    ) {
      applyBlock(line, { type: "paragraph" }, "");
      return;
    }
    setLineText(line, before);
    const continueType = ["code", "quote", "bullet", "task", "numbered"].includes(type)
      ? type
      : "paragraph";
    const created = createLine({
      type: continueType,
      text: after,
      checked: line.dataset.checked === "true",
      start: type === "numbered" ? Number(line.dataset.start || 1) + 1 : 1,
    });
    line.after(created);
    placeCaret(created, 0);
  }

  function tryMergeBackspace() {
    const selection = view.getSelection();
    if (!selection?.isCollapsed) {
      return false;
    }
    const line = currentLine();
    if (!line) {
      return false;
    }
    if (line.dataset.type === "hr") {
      const previous = line.previousElementSibling;
      line.remove();
      if (!editor.querySelector(".mint-line")) {
        editor.appendChild(createLine({ type: "paragraph", text: "" }));
      }
      const target = previous || editor.querySelector(".mint-line");
      placeCaret(target, lineText(target).length);
      return true;
    }
    if (caretOffset(line) !== 0) {
      return false;
    }
    const previous = line.previousElementSibling;
    if (!previous) {
      return false;
    }
    if (previous.dataset.type === "hr") {
      previous.remove();
      return true;
    }
    const previousText = lineText(previous);
    setLineText(previous, previousText + lineText(line));
    line.remove();
    placeCaret(previous, previousText.length);
    return true;
  }

  function pasteText(text) {
    const selection = view.getSelection();
    if (selection && !selection.isCollapsed) {
      selection.deleteFromDocument();
    }
    const line = currentLine() || editor.querySelector(".mint-line");
    if (!line) {
      render(parseMarkdown(text));
      return;
    }
    const parsed = parseMarkdown(text);
    const offset = caretOffset(line);
    const current = lineText(line);
    const before = current.slice(0, offset);
    const after = current.slice(offset);
    if (parsed.length === 1 && parsed[0].type === "paragraph") {
      setLineText(line, before + parsed[0].text + after);
      placeCaret(line, before.length + parsed[0].text.length);
      return;
    }
    const [first, ...rest] = parsed;
    const last = rest.pop();
    applyBlock(line, first.type === "paragraph" ? { type: line.dataset.type } : first, before + first.text);
    let anchor = line;
    for (const middle of rest) {
      const created = createLine(middle);
      anchor.after(created);
      anchor = created;
    }
    const tail = last || { type: "paragraph", text: "" };
    const created = createLine({ ...tail, text: `${tail.text || ""}${after}` });
    anchor.after(created);
    placeCaret(created, (tail.text || "").length);
  }

  function refreshGutter() {
    const lines = [...editor.querySelectorAll(".mint-line")];
    gutter.replaceChildren();
    for (let index = 0; index < lines.length; index++) {
      const number = doc.createElement("div");
      number.className = "mint-gutter-line";
      number.textContent = String(index + 1);
      number.style.height = `${Math.max(lines[index].offsetHeight, 1)}px`;
      gutter.appendChild(number);
    }
  }

  function paintHighlights() {
    for (const kind of Object.keys(highlights)) {
      highlights[kind].clear();
    }
    if (!Object.keys(highlights).length) {
      return;
    }
    for (const line of editor.querySelectorAll(".mint-line")) {
      if (line.dataset.type === "code" || line.dataset.type === "hr") {
        continue;
      }
      const textNode = [...line.childNodes].find(
        node => node.nodeType === Node.TEXT_NODE && node.data
      );
      if (!textNode) {
        continue;
      }
      for (const rangeInfo of inlineRanges(textNode.data)) {
        const range = doc.createRange();
        range.setStart(textNode, rangeInfo.start);
        range.setEnd(textNode, rangeInfo.end);
        highlights[rangeInfo.kind]?.add(range);
      }
    }
  }

  function automaticTitle() {
    return noteTitle(readLines());
  }

  function visibleTitle() {
    return state.customTitle || automaticTitle();
  }

  function applyRenameTooltip() {
    if (!titleEl) {
      return;
    }
    let tip = RENAME_TITLE_TOOLTIP;
    if (doc.l10n?.formatMessagesSync) {
      try {
        const [message] = doc.l10n.formatMessagesSync([{ id: DEFAULT_TITLE_L10N }]);
        const localized = message?.attributes?.find(attr => attr.name === "title")?.value;
        if (localized) {
          tip = localized;
        }
      } catch (error) {
        console.error("Notepad title tooltip localization failed", error);
      }
    }
    titleEl.setAttribute("title", tip);
  }

  function updateTitle() {
    if (!titleEl || state.editingTitle) {
      return;
    }
    try {
      const derived = visibleTitle();
      const titleTag = doc.querySelector("title");
      if (!derived) {
        doc.title = "Notepad";
        if (doc.l10n) {
          titleEl.setAttribute("data-l10n-id", DEFAULT_TITLE_L10N);
          titleEl.setAttribute("data-l10n-attrs", "title");
          doc.l10n.setAttributes(titleEl, DEFAULT_TITLE_L10N);
          if (titleTag) {
            doc.l10n.setAttributes(titleTag, DEFAULT_TITLE_L10N);
          }
        } else {
          titleEl.textContent = "Notepad";
          if (titleTag) {
            titleTag.textContent = "Notepad";
          }
          applyRenameTooltip();
        }
        return;
      }
      titleEl.removeAttribute("data-l10n-id");
      titleEl.removeAttribute("data-l10n-attrs");
      titleEl.textContent = derived;
      doc.title = derived;
      if (titleTag) {
        titleTag.textContent = derived;
      }
      applyRenameTooltip();
    } catch (error) {
      console.error("Notepad title update failed", error);
    }
  }

  function beginTitleEdit() {
    if (!titleEl || state.editingTitle) {
      return;
    }
    state.editingTitle = true;
    titleEl.removeAttribute("data-l10n-id");
    titleEl.textContent = state.customTitle ?? automaticTitle() ?? "";
    titleEl.contentEditable = "true";
    titleEl.classList.add("mint-note-title-editing");
    titleEl.focus();
    const selection = view.getSelection();
    const range = doc.createRange();
    range.selectNodeContents(titleEl);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  function commitTitleEdit(cancel = false) {
    if (!titleEl || !state.editingTitle) {
      return;
    }
    state.editingTitle = false;
    titleEl.contentEditable = "false";
    titleEl.classList.remove("mint-note-title-editing");
    if (cancel) {
      updateTitle();
      return;
    }
    const next = titleEl.textContent.replace(/\s+/g, " ").trim();
    const auto = automaticTitle();
    state.customTitle = !next || next === auto ? null : next;
    updateTitle();
    state.dirty = true;
    if (state.armed) {
      scheduleAutosave();
    } else {
      setStatus("unsaved");
    }
  }

  function closeMenu() {
    state.menuItems = [];
    state.menuIndex = 0;
    menu.hidden = true;
    menu.replaceChildren();
  }

  function updateMenu() {
    const line = currentLine();
    if (!line || (line.dataset.type !== "paragraph" && line.dataset.type !== "table")) {
      closeMenu();
      return;
    }
    const offset = caretOffset(line);
    const before = lineText(line).slice(0, offset);
    const items = autocompleteMatches(before);
    if (!items.length) {
      closeMenu();
      return;
    }
    state.menuItems = items;
    if (state.menuIndex >= items.length) {
      state.menuIndex = 0;
    }
    menu.replaceChildren();
    items.forEach((item, index) => {
      const option = doc.createElement("button");
      option.type = "button";
      option.className = "mint-note-option";
      option.role = "option";
      option.dataset.command = item.id;
      option.textContent = COMMAND_LABELS[item.id] || item.id;
      option.setAttribute("aria-selected", index === state.menuIndex ? "true" : "false");
      const l10nId = `zen-notepad-command-${item.id}`;
      doc.l10n?.setAttributes(option, l10nId);
      option.addEventListener("mousedown", event => {
        event.preventDefault();
        state.menuIndex = index;
        applySelected();
      });
      menu.appendChild(option);
    });
    const selection = view.getSelection();
    const rect = selection?.rangeCount ? selection.getRangeAt(0).getBoundingClientRect() : null;
    if (!rect || (!rect.top && !rect.left && !rect.height)) {
      menu.hidden = true;
      return;
    }
    menu.hidden = false;
    menu.style.left = `${Math.max(8, rect.left)}px`;
    menu.style.top = `${rect.bottom + 6}px`;
  }

  function moveMenu(step) {
    if (!state.menuItems.length) {
      return;
    }
    state.menuIndex = (state.menuIndex + step + state.menuItems.length) % state.menuItems.length;
    [...menu.children].forEach((option, index) => {
      option.setAttribute("aria-selected", index === state.menuIndex ? "true" : "false");
    });
  }

  function applySelected() {
    const command = state.menuItems[state.menuIndex];
    const line = currentLine();
    if (!command || !line) {
      closeMenu();
      return;
    }
    const offset = caretOffset(line);
    const text = lineText(line);
    const before = text.slice(0, offset);
    const after = text.slice(offset);
    const result = commandResult(command, before);
    if (result.kind === "insert") {
      setLineText(line, result.text + after);
      placeCaret(line, result.caret);
    } else {
      applyBlock(line, result, after);
    }
    closeMenu();
    afterEdit();
    refreshSoon();
  }

  function refreshSoon() {
    view.requestAnimationFrame(() => {
      refreshGutter();
      paintHighlights();
      updateTitle();
      updateMenu();
    });
  }

  function markdownNow() {
    return serializeMarkdown(readLines());
  }

  async function adoptURL(id) {
    const normalized = id.toLowerCase();
    const current = parseNoteURL(view.location.href) || parseNoteURL(doc.documentURI);
    if (current?.id === normalized) {
      return;
    }
    try {
      await bridge.adoptURL(noteURL(normalized));
    } catch (error) {
      console.error("Notepad could not update its address", error);
    }
  }

  async function persist({ auto = false } = {}) {
    const markdown = markdownNow();
    const id = state.id || crypto.randomUUID();
    const wasArmed = state.armed;
    try {
      setStatus("saving");
      const savedId = id.toLowerCase();
      await bridge.save(savedId, markdown, state.customTitle);
      state.id = savedId;
      state.armed = true;
      state.dirty = false;
      await adoptURL(savedId);
      setStatus("saved");
      return true;
    } catch (error) {
      console.error("Notepad save failed", error);
      state.armed = wasArmed;
      setStatus("error");
      if (!auto) {
        state.dirty = true;
      }
      return false;
    }
  }

  async function saveNow(options) {
    if (state.saving) {
      state.saveAgain = true;
      return state.saving;
    }
    state.saving = persist(options).finally(() => {
      state.saving = null;
    });
    const saved = await state.saving;
    if (state.saveAgain) {
      state.saveAgain = false;
      return saveNow(options);
    }
    return saved;
  }

  function clearAutosave() {
    try {
      state.timer?.cancel();
    } catch (error) {
      // The timer may already have fired.
    }
    state.timer = null;
  }

  function scheduleAutosave() {
    if (!state.armed) {
      return;
    }
    clearAutosave();
    const timer = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
    state.timer = timer;
    timer.initWithCallback(() => {
      if (state.timer !== timer || !state.armed || !state.dirty) {
        return;
      }
      saveNow({ auto: true });
    }, AUTOSAVE_MS, Ci.nsITimer.TYPE_ONE_SHOT);
  }

  function afterEdit() {
    state.dirty = true;
    if (!state.armed) {
      setStatus("unsaved");
    }
    scheduleAutosave();
  }

  function flushOnHide() {
    clearAutosave();
    if (!state.armed || !state.dirty) {
      return;
    }
    const pending = saveNow({ auto: true });
    const thread = Services.tm.currentThread;
    let done = false;
    pending.finally(() => {
      done = true;
    });
    const started = Date.now();
    while (!done && Date.now() - started < 2000) {
      thread.processNextEvent(true);
    }
  }

  async function exportNote() {
    const lines = readLines();
    await bridge.exportNote(
      serializeMarkdown(lines),
      exportFileName(lines, state.customTitle)
    );
  }

  function onEditorKeyDown(event) {
    if (event.isComposing) {
      return;
    }
    if (!menu.hidden && state.menuItems.length) {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        moveMenu(event.key === "ArrowDown" ? 1 : -1);
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        closeMenu();
        return;
      }
      if (eventMatchesShortcut(event, shortcutSpec())) {
        event.preventDefault();
        applySelected();
        return;
      }
    }
    if (event.key === "Backspace" && !event.altKey && !event.ctrlKey && !event.metaKey) {
      if (tryMergeBackspace()) {
        event.preventDefault();
        afterEdit();
        refreshSoon();
      }
    }
  }

  editor.addEventListener("beforeinput", event => {
    if (event.isComposing) {
      return;
    }
    if (event.inputType === "insertParagraph") {
      event.preventDefault();
      splitLine();
      afterEdit();
      refreshSoon();
      return;
    }
    if (event.inputType === "insertText" && event.data === " ") {
      if (tryCommitSpace()) {
        event.preventDefault();
        afterEdit();
        refreshSoon();
      }
      return;
    }
    if (event.inputType === "insertFromPaste") {
      event.preventDefault();
      pasteText(event.dataTransfer?.getData("text/plain") || event.data || "");
      afterEdit();
      refreshSoon();
    }
  });

  editor.addEventListener("keydown", onEditorKeyDown);
  editor.addEventListener("input", () => {
    for (const line of editor.querySelectorAll(".mint-line")) {
      if (!line.dataset.type) {
        line.dataset.type = "paragraph";
        line.classList.add("mint-line");
      }
      if (line.dataset.type === "paragraph" || line.dataset.type === "table") {
        line.dataset.type = /^\s*\|.+\|\s*$/.test(lineText(line)) ? "table" : "paragraph";
      }
    }
    if (!editor.querySelector(".mint-line")) {
      editor.appendChild(createLine({ type: "paragraph", text: "" }));
    }
    afterEdit();
    refreshSoon();
  });

  editor.addEventListener("click", event => {
    const button = event.target.closest?.(".mint-task");
    if (!button) {
      return;
    }
    event.preventDefault();
    const line = button.closest(".mint-line");
    const checked = line.dataset.checked !== "true";
    line.dataset.checked = checked ? "true" : "false";
    button.setAttribute("aria-pressed", checked ? "true" : "false");
    afterEdit();
  });

  if (titleEl) {
    titleEl.addEventListener("dblclick", event => {
      event.preventDefault();
      beginTitleEdit();
    });
    titleEl.addEventListener("keydown", event => {
      if (!state.editingTitle) {
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        commitTitleEdit();
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        commitTitleEdit(true);
      }
    });
    titleEl.addEventListener("blur", () => {
      commitTitleEdit();
    });
    titleEl.addEventListener("input", () => {
      if (!state.editingTitle) {
        return;
      }
      const text = titleEl.textContent.replace(/\n/g, "");
      if (titleEl.textContent !== text) {
        titleEl.textContent = text;
        placeCaret(titleEl, text.length);
      }
    });
  }

  saveButton.addEventListener("click", () => {
    saveNow();
  });
  exportButton.addEventListener("click", () => {
    exportNote();
  });
  view.addEventListener("pagehide", flushOnHide);
  view.addEventListener("resize", refreshSoon);

  async function start() {
    render([ { type: "paragraph", text: "" } ]);
    const parsed = parseNoteURL(view.location.href) || parseNoteURL(doc.documentURI);
    if (parsed?.id) {
      state.id = parsed.id;
      try {
        const stored = await bridge.load(parsed.id);
        if (stored != null) {
          const markdown =
            typeof stored === "string" ? stored : stored.markdown;
          state.customTitle =
            typeof stored === "object" && stored.title ? stored.title : null;
          render(parseMarkdown(markdown));
          state.armed = true;
          setStatus("saved");
        }
      } catch (error) {
        console.error("Notepad load failed", error);
        setStatus("error");
      }
    }
    if (!editor.querySelector(".mint-line")) {
      render([{ type: "paragraph", text: "" }]);
    }
    refreshSoon();
    editor.focus();
    state.ready = true;
    const scope = Cu.waiveXrays(view);
    scope.MintNotepad = Cu.cloneInto(
      {
        ready: true,
        text() {
          return markdownNow();
        },
        lineType(index = 0) {
          return editor.querySelectorAll(".mint-line")[index]?.dataset.type || "";
        },
        menuOpen() {
          return !menu.hidden;
        },
        selectedCommand() {
          return menu.querySelector("[aria-selected='true']")?.dataset.command || "";
        },
        armed() {
          return state.armed;
        },
        pageTitle() {
          return visibleTitle() || "Notepad";
        },
      },
      scope,
      { cloneFunctions: true }
    );
  }

  await start();
  doc.documentElement.dataset.mintNotepad = "ready";
}
