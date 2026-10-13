/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const NOTE_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MODIFIER_KEYS = new Set(["control", "shift", "alt", "meta"]);
const MODIFIER_ORDER = ["alt", "ctrl", "meta", "shift"];

export const COMMANDS = [
  { id: "h1", triggers: ["#"], kind: "block", type: "h1" },
  { id: "h2", triggers: ["##"], kind: "block", type: "h2" },
  { id: "h3", triggers: ["###"], kind: "block", type: "h3" },
  { id: "h4", triggers: ["####"], kind: "block", type: "h4" },
  { id: "h5", triggers: ["#####"], kind: "block", type: "h5" },
  { id: "h6", triggers: ["######"], kind: "block", type: "h6" },
  { id: "bullet", triggers: ["-", "*", "+"], kind: "block", type: "bullet" },
  {
    id: "numbered",
    kind: "block",
    type: "numbered",
    match: query => /^\d+\.?$/.test(query),
  },
  { id: "quote", triggers: [">"], kind: "block", type: "quote" },
  { id: "code", triggers: ["`", "``", "```"], kind: "block", type: "code" },
  {
    id: "task",
    triggers: ["- [ ]", "- [x]", "- [X]", "* [ ]", "* [x]", "+ [ ]"],
    kind: "block",
    type: "task",
  },
  { id: "hr", triggers: ["---", "***", "___"], kind: "block", type: "hr" },
  { id: "link", triggers: ["["], kind: "insert", insert: "[]()", caret: 1 },
  { id: "image", triggers: ["!["], kind: "insert", insert: "![]()", caret: 2 },
  { id: "bold", triggers: ["**", "__"], kind: "insert", insert: "****", caret: 2 },
  { id: "strike", triggers: ["~~"], kind: "insert", insert: "~~~~", caret: 2 },
  { id: "inline-code", triggers: ["`"], kind: "insert", insert: "``", caret: 1 },
];

export function isNoteId(value) {
  return typeof value === "string" && NOTE_ID.test(value);
}

export function parseNoteURL(spec) {
  if (!spec || typeof spec !== "string") {
    return null;
  }
  let url;
  try {
    url = new URL(spec);
  } catch {
    return null;
  }
  if (url.protocol !== "mint:") {
    return null;
  }
  const host = url.hostname;
  const path = url.pathname || "";
  if (host === "note" && (path === "" || path === "/")) {
    return { id: null };
  }
  if (host === "note") {
    const id = path.replace(/^\//, "");
    if (isNoteId(id)) {
      return { id: id.toLowerCase() };
    }
    return null;
  }
  const parts = path.split("/").filter(Boolean);
  if (host === "" && parts[0] === "note" && parts.length === 1) {
    return { id: null };
  }
  if (host === "" && parts[0] === "note" && parts.length === 2 && isNoteId(parts[1])) {
    return { id: parts[1].toLowerCase() };
  }
  return null;
}

export function noteURL(id) {
  if (!isNoteId(id)) {
    throw new Error("Invalid note id");
  }
  return `mint://note/${id.toLowerCase()}`;
}

export function commitOnSpace(line) {
  const text = line.text ?? "";
  if (line.type === "code") {
    if (text === "```") {
      return { type: "paragraph", text: "" };
    }
    return null;
  }
  if (line.type !== "paragraph" && line.type !== "table") {
    return null;
  }
  const heading = /^(#{1,6})$/.exec(text);
  if (heading) {
    return { type: `h${heading[1].length}`, text: "" };
  }
  if (text === "-" || text === "*" || text === "+") {
    return { type: "bullet", text: "" };
  }
  const ordered = /^(\d+)\.$/.exec(text);
  if (ordered) {
    return { type: "numbered", text: "", start: Number(ordered[1]) };
  }
  if (text === ">") {
    return { type: "quote", text: "" };
  }
  if (text === "```") {
    return { type: "code", text: "" };
  }
  const task = /^[-*+] \[([ xX])\]$/.exec(text);
  if (task) {
    return {
      type: "task",
      text: "",
      checked: task[1].toLowerCase() === "x",
    };
  }
  if (text === "---" || text === "***" || text === "___") {
    return { type: "hr", text: "" };
  }
  return null;
}

export function autocompleteMatches(query) {
  if (!query || /\s/.test(query)) {
    return [];
  }
  const matched = [];
  for (const command of COMMANDS) {
    const triggers = command.triggers || [];
    const regexMatch = !triggers.length && command.match?.(query);
    const exact = triggers.includes(query) || regexMatch;
    const partial = triggers.some(trigger => trigger.startsWith(query)) || regexMatch;
    if (!exact && !partial) {
      continue;
    }
    matched.push({ command, exact });
  }
  matched.sort((a, b) => Number(b.exact) - Number(a.exact));
  return matched.map(entry => entry.command);
}

export function commandResult(command, query) {
  if (command.kind === "insert") {
    return { kind: "insert", text: command.insert, caret: command.caret };
  }
  const result = { kind: "block", type: command.type, text: "" };
  if (command.type === "numbered") {
    result.start = Number.parseInt(query, 10) || 1;
  }
  if (command.type === "task") {
    result.checked = /\[[xX]\]/.test(query);
  }
  return result;
}

function emptyLine() {
  return { type: "paragraph", text: "" };
}

export function parseMarkdown(markdown) {
  const source = String(markdown ?? "").replace(/\r\n/g, "\n");
  if (source === "") {
    return [emptyLine()];
  }
  const rawLines = source.split("\n");
  const lines = [];
  let inCode = false;
  for (const raw of rawLines) {
    if (inCode) {
      if (/^```\s*$/.test(raw)) {
        inCode = false;
      } else {
        lines.push({ type: "code", text: raw });
      }
      continue;
    }
    if (/^```/.test(raw)) {
      inCode = true;
      continue;
    }
    if (/^(?:---|\*\*\*|___)\s*$/.test(raw)) {
      lines.push({ type: "hr", text: "" });
      continue;
    }
    const heading = /^(#{1,6})\s+(.*)$/.exec(raw);
    if (heading) {
      lines.push({ type: `h${heading[1].length}`, text: heading[2] });
      continue;
    }
    const task = /^[-*+] \[([ xX])\]\s?(.*)$/.exec(raw);
    if (task) {
      lines.push({
        type: "task",
        text: task[2],
        checked: task[1].toLowerCase() === "x",
      });
      continue;
    }
    const ordered = /^(\d+)\.\s+(.*)$/.exec(raw);
    if (ordered) {
      lines.push({
        type: "numbered",
        text: ordered[2],
        start: Number(ordered[1]),
      });
      continue;
    }
    const bullet = /^[-*+]\s+(.*)$/.exec(raw);
    if (bullet) {
      lines.push({ type: "bullet", text: bullet[1] });
      continue;
    }
    const quote = /^>\s?(.*)$/.exec(raw);
    if (quote) {
      lines.push({ type: "quote", text: quote[1] });
      continue;
    }
    if (/^\s*\|.+\|\s*$/.test(raw)) {
      lines.push({ type: "table", text: raw });
      continue;
    }
    lines.push({ type: "paragraph", text: raw });
  }
  if (inCode) {
    lines.push({ type: "paragraph", text: "" });
  }
  return lines.length ? lines : [emptyLine()];
}

function serializeOne(line) {
  switch (line.type) {
    case "h1":
    case "h2":
    case "h3":
    case "h4":
    case "h5":
    case "h6":
      return `${"#".repeat(Number(line.type.slice(1)))} ${line.text}`;
    case "bullet":
      return `- ${line.text}`;
    case "numbered":
      return `${line.start || 1}. ${line.text}`;
    case "quote":
      return `> ${line.text}`;
    case "task":
      return `- [${line.checked ? "x" : " "}] ${line.text}`;
    case "hr":
      return "---";
    case "table":
    case "code":
    case "paragraph":
    default:
      return line.text ?? "";
  }
}

export function serializeMarkdown(lines) {
  const out = [];
  let inCode = false;
  for (const line of lines) {
    if (line.type === "code") {
      if (!inCode) {
        out.push("```");
        inCode = true;
      }
      out.push(line.text ?? "");
      continue;
    }
    if (inCode) {
      out.push("```");
      inCode = false;
    }
    out.push(serializeOne(line));
  }
  if (inCode) {
    out.push("```");
  }
  return out.join("\n");
}

export function noteTitle(lines) {
  for (const line of lines) {
    if (line.type === "hr" || line.type === "code") {
      continue;
    }
    const text = String(line.text ?? "")
      .replace(/[*_`~[\]]/g, "")
      .trim();
    if (text) {
      return text;
    }
  }
  return "";
}

export function inlineRanges(text) {
  const ranges = [];
  const occupied = [];
  const take = (start, end, kind) => {
    if (end <= start) {
      return;
    }
    if (occupied.some(([from, to]) => start < to && end > from)) {
      return;
    }
    occupied.push([start, end]);
    ranges.push({ start, end, kind });
  };
  const collect = (expression, kind) => {
    for (const match of text.matchAll(expression)) {
      take(match.index, match.index + match[0].length, kind);
    }
  };
  collect(/`[^`\n]+`/g, "code");
  collect(/!\[[^\]]*\]\([^)]+\)/g, "image");
  collect(/\[[^\]]+\]\([^)]+\)/g, "link");
  collect(/~~.+?~~/g, "strike");
  collect(/\*\*.+?\*\*|__.+?__/g, "bold");
  collect(
    /(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)|(?<!_)_(?!_)(.+?)(?<!_)_(?!_)/g,
    "italic"
  );
  return ranges;
}

export function shortcutFromEvent(event) {
  const key = event.key;
  if (!key || MODIFIER_KEYS.has(key.toLowerCase())) {
    return null;
  }
  const parts = [];
  if (event.ctrlKey) {
    parts.push("Ctrl");
  }
  if (event.altKey) {
    parts.push("Alt");
  }
  if (event.shiftKey) {
    parts.push("Shift");
  }
  if (event.metaKey) {
    parts.push("Meta");
  }
  parts.push(key === " " ? "Space" : key.length === 1 ? key.toUpperCase() : key);
  return parts.join("+");
}

function parseShortcut(spec) {
  const bits = String(spec || "Tab")
    .split("+")
    .map(part => part.trim())
    .filter(Boolean);
  const keyName = (bits.pop() || "Tab").toLowerCase();
  const mods = new Set(bits.map(part => part.toLowerCase()));
  return {
    key: keyName,
    mods: MODIFIER_ORDER.filter(name => mods.has(name)).join("+"),
  };
}

export function eventMatchesShortcut(event, spec) {
  const expected = parseShortcut(spec);
  const key = event.key === " " ? "space" : String(event.key || "").toLowerCase();
  if (!key || MODIFIER_KEYS.has(key)) {
    return false;
  }
  const mods = [];
  if (event.altKey) {
    mods.push("alt");
  }
  if (event.ctrlKey) {
    mods.push("ctrl");
  }
  if (event.metaKey) {
    mods.push("meta");
  }
  if (event.shiftKey) {
    mods.push("shift");
  }
  return key === expected.key && mods.join("+") === expected.mods;
}

export function exportFileName(lines, customTitle = null) {
  const title = customTitle || noteTitle(lines) || "note";
  const cleaned = title
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/[\u0000-\u001f]/g, "")
    .trim();
  return `${cleaned || "note"}.md`;
}
