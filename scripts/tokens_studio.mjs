// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import {
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { TOKENS_DIR, loadZenTokens } from "../src/zen/tokens/tokens.mjs";

export const STUDIO_FILE = join(TOKENS_DIR, "tokens-studio.json");

export const PULL_DIR = join(TOKENS_DIR, "../../../.tokens-studio");

const SETS = ["base", "light", "dark"];

const TYPES = {
  "background-color": "color",
  "text-color": "color",
  "icon-color": "color",
  "border-color": "color",
  "versatile-color": "color",
  space: "spacing",
  size: "sizing",
  "border-radius": "borderRadius",
  "font-size": "fontSizes",
  "font-weight": "fontWeights",
  opacity: "opacity",
  "box-shadow": "boxShadow",
};

const NAMED_COLORS = { white: [255, 255, 255, 1], black: [0, 0, 0, 1] };

/**
 * Parses a literal CSS color.
 *
 * @param {string} text
 * @returns {number[] | null} [r, g, b, a], or null if it is not a literal.
 */
function parseColor(text) {
  const value = text.trim().toLowerCase();
  if (value in NAMED_COLORS) {
    return NAMED_COLORS[value];
  }
  if (value === "transparent") {
    return [0, 0, 0, 0];
  }
  let match = value.match(/^#([0-9a-f]{3,8})$/);
  if (match && [3, 4, 6, 8].includes(match[1].length)) {
    let hex = match[1];
    if (hex.length < 6) {
      hex = [...hex].map(c => c + c).join("");
    }
    const channel = i => parseInt(hex.slice(i, i + 2), 16);
    return [
      channel(0),
      channel(2),
      channel(4),
      hex.length === 8 ? channel(6) / 255 : 1,
    ];
  }
  match = value.match(/^rgba?\(([^()]+)\)$/);
  if (match) {
    const parts = match[1].split(/[\s,/]+/).filter(Boolean);
    if (parts.length < 3 || parts.length > 4) {
      return null;
    }
    const numbers = parts.map((part, i) => {
      const number = parseFloat(part);
      if (!part.endsWith("%")) {
        return number;
      }
      return i === 3 ? number / 100 : (number * 255) / 100;
    });
    if (numbers.some(Number.isNaN)) {
      return null;
    }
    return [numbers[0], numbers[1], numbers[2], numbers[3] ?? 1];
  }
  return null;
}

function toHex([r, g, b, a]) {
  const hex = n =>
    Math.round(Math.min(255, Math.max(0, n)))
      .toString(16)
      .padStart(2, "0");
  return `#${hex(r)}${hex(g)}${hex(b)}${a < 1 ? hex(a * 255) : ""}`;
}

function sameColor(a, b) {
  const x = parseColor(a);
  const y = parseColor(b);
  return !!x && !!y && toHex(x) === toHex(y);
}

const LENGTH = /^(0|-?(\d+\.?\d*|\.\d+)(px|rem))$/;

function splitTopLevel(text, separator) {
  const parts = [];
  let depth = 0;
  let current = "";
  for (const char of text) {
    if (char === "(") {
      depth++;
    } else if (char === ")") {
      depth--;
    }
    if (depth === 0 && separator.test(char)) {
      if (current) {
        parts.push(current);
      }
      current = "";
    } else {
      current += char;
    }
  }
  if (current) {
    parts.push(current);
  }
  return parts;
}

/**
 * Parses a box-shadow made only of literals.
 *
 * @param {string} text
 * @returns {object[] | null} One Tokens Studio shadow per layer.
 */
function parseShadow(text) {
  const layers = [];
  for (const layer of splitTopLevel(text, /,/)) {
    const parts = splitTopLevel(layer.trim(), /\s/);
    let type = "dropShadow";
    let color = null;
    const lengths = [];
    for (const part of parts) {
      if (part === "inset") {
        type = "innerShadow";
      } else if (LENGTH.test(part)) {
        lengths.push(parseFloat(part) === 0 ? "0" : part);
      } else if (parseColor(part) && !color) {
        color = toHex(parseColor(part));
      } else {
        return null;
      }
    }
    if (!color || lengths.length < 2 || lengths.length > 4) {
      return null;
    }
    const [x, y, blur = "0", spread = "0"] = lengths;
    layers.push({ x, y, blur, spread, color, type });
  }
  return layers.length ? layers : null;
}

function shadowToCss(value) {
  return (Array.isArray(value) ? value : [value])
    .map(layer =>
      [
        layer.type === "innerShadow" || layer.inset ? "inset" : "",
        layer.x ?? layer.offsetX,
        layer.y ?? layer.offsetY,
        layer.blur,
        parseFloat(layer.spread ?? 0) === 0 ? "" : layer.spread,
        layer.color,
      ]
        .filter(part => part !== "" && part !== undefined)
        .map(part => (parseFloat(part) === 0 ? "0" : part))
        .join(" ")
    )
    .join(", ");
}

function sameShadow(a, b) {
  const x = parseShadow(a);
  const y = parseShadow(b);
  return !!x && !!y && JSON.stringify(x) === JSON.stringify(y);
}

/**
 * Converts one token to its Tokens Studio representation.
 *
 * @param {import("../src/zen/tokens/tokens.mjs").ZenToken} token
 * @returns {{type: string, values: Record<string, unknown>} | null}
 *   The value of the token in each set it belongs to, or null if the token
 *   cannot be represented in Figma.
 */
function toStudio(token) {
  const type = TYPES[token.group];
  if (!type || token.external) {
    return null;
  }
  const { value } = token;
  if (type === "color") {
    if (typeof value === "object") {
      const light = parseColor(value.light);
      const dark = parseColor(value.dark);
      return light && dark
        ? { type, values: { light: toHex(light), dark: toHex(dark) } }
        : null;
    }
    const color = parseColor(value);
    return color ? { type, values: { base: toHex(color) } } : null;
  }
  if (typeof value !== "string") {
    return null;
  }
  if (type === "boxShadow") {
    const shadow = parseShadow(value);
    if (!shadow) {
      return null;
    }
    return { type, values: { base: shadow.length === 1 ? shadow[0] : shadow } };
  }
  if (type === "opacity" || type === "fontWeights") {
    return /^\d*\.?\d+$/.test(value) ? { type, values: { base: value } } : null;
  }
  return LENGTH.test(value) ? { type, values: { base: value } } : null;
}

/** Builds the contents of tokens-studio.json from the tokens files. */
export function buildStudioFile() {
  const sets = Object.fromEntries(SETS.map(set => [set, {}]));
  for (const token of loadZenTokens()) {
    const studio = toStudio(token);
    if (!studio) {
      continue;
    }
    for (const [set, value] of Object.entries(studio.values)) {
      sets[set][token.group] ??= {};
      sets[set][token.group][token.name.slice(2)] = {
        value,
        type: studio.type,
      };
    }
  }
  const theme = (name, mode) => ({
    id: `zen-${mode}`,
    name,
    group: "Zen",
    selectedTokenSets: { base: "enabled", [mode]: "enabled" },
  });
  const file = {
    ...sets,
    $themes: [theme("Light", "light"), theme("Dark", "dark")],
    $metadata: { tokenSetOrder: SETS },
  };
  return `${JSON.stringify(file, null, 2)}\n`;
}

function print(value, indent, column, trailing) {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  const array = Array.isArray(value);
  const entries = array
    ? value.map(item => [null, item])
    : Object.entries(value);
  const [open, close] = array ? "[]" : "{}";
  if (!entries.length) {
    return open + close;
  }
  const key = name => (name === null ? "" : `${JSON.stringify(name)}: `);
  const flat = entries
    .map(([name, item]) => key(name) + print(item, 0, 0, 0))
    .join(", ");
  const inline = array ? `[${flat}]` : `{ ${flat} }`;
  if (!inline.includes("\n") && column + inline.length + trailing <= 80) {
    return inline;
  }
  const pad = " ".repeat(indent + 2);
  const lines = entries.map(([name, item], i) => {
    const prefix = pad + key(name);
    const comma = i < entries.length - 1 ? 1 : 0;
    return (
      prefix +
      print(item, indent + 2, prefix.length, comma) +
      (comma ? "," : "")
    );
  });
  return `${open}\n${lines.join("\n")}\n${" ".repeat(indent)}${close}`;
}

export function formatTokensFile(groups) {
  const body = Object.entries(groups).map(([group, tokens]) => {
    const names = Object.keys(tokens);
    const lines = names.map((name, i) => {
      const prefix = `    ${JSON.stringify(name)}: `;
      const comma = i < names.length - 1 ? 1 : 0;
      return (
        prefix +
        print(tokens[name], 4, prefix.length, comma) +
        (comma ? "," : "")
      );
    });
    return `  ${JSON.stringify(group)}: {\n${lines.join("\n")}\n  }`;
  });
  return `{\n${body.join(",\n")}\n}\n`;
}

// Collects `--name -> value` from a tree of token groups, whichever of the
// `value` (Tokens Studio) or `$value` (DTCG) spellings it uses. The top-level
// group a token is in is its category.
function collect(tree, set, incoming, group = null) {
  for (const [key, node] of Object.entries(tree ?? {})) {
    if (key.startsWith("$") || node === null || typeof node !== "object") {
      continue;
    }
    const value = node.$value ?? node.value;
    if (value === undefined) {
      collect(node, set, incoming, group ?? key);
      continue;
    }
    const entry = incoming.get(`--${key}`) ?? { group };
    entry[set] = value;
    incoming.set(`--${key}`, entry);
  }
}

function readIncoming(source) {
  if (!existsSync(source)) {
    throw new Error(
      `${source} does not exist. Run \`npm run tokens:pull\`, which downloads it with the Tokens Studio CLI.`
    );
  }
  const incoming = new Map();
  if (statSync(source).isDirectory()) {
    for (const set of SETS) {
      const path = join(source, `${set}.json`);
      if (existsSync(path)) {
        collect(JSON.parse(readFileSync(path, "utf8")), set, incoming);
      }
    }
  } else {
    const file = JSON.parse(readFileSync(source, "utf8"));
    for (const set of SETS) {
      collect(file[set], set, incoming);
    }
  }
  return incoming;
}

function fileForNewToken(name) {
  const components = readdirSync(join(TOKENS_DIR, "components"))
    .filter(file => file.endsWith(".tokens.json"))
    .map(file => file.replace(/\.tokens\.json$/, ""))
    .sort((a, b) => b.length - a.length);
  const component = components.find(prefix =>
    name.startsWith(`--zen-${prefix}-`)
  );
  return component ? `components/${component}.tokens.json` : "base.tokens.json";
}

/**
 * Converts a token that only exists in Tokens Studio to a tokens file entry.
 *
 * @param {string} name
 * @param {{group: string, base?: unknown, light?: unknown, dark?: unknown}} entry
 * @returns {{value: unknown} | {reason: string}}
 */
function fromStudio(name, entry) {
  const type = TYPES[entry.group];
  if (!type) {
    return { reason: `"${entry.group}" is not a token category` };
  }
  if (!/^--zen-[a-z0-9-]+$/.test(name)) {
    return { reason: "the name must be lowercase and start with zen-" };
  }
  const css = value =>
    type === "boxShadow" ? shadowToCss(value) : String(value);
  let value;
  if (entry.light !== undefined && entry.dark !== undefined) {
    value = { light: css(entry.light), dark: css(entry.dark) };
  } else if (entry.base !== undefined) {
    value = css(entry.base);
  } else {
    return { reason: "it needs a value in both the light and the dark set" };
  }
  const token = { group: entry.group, value, external: false };
  if (!toStudio(token)) {
    return { reason: `its value is not a literal ${type} value` };
  }
  return { value };
}

export function importStudioTokens(source = PULL_DIR) {
  const incoming = readIncoming(source);

  const changed = [];
  const missing = [];
  const known = new Set();
  const files = new Map();
  const open = file => {
    if (!files.has(file)) {
      const path = join(TOKENS_DIR, file);
      files.set(file, {
        path,
        groups: JSON.parse(readFileSync(path, "utf8")),
        dirty: false,
      });
    }
    return files.get(file);
  };
  const tokens = loadZenTokens();
  for (const token of tokens) {
    const studioToken = toStudio(token);
    const next = incoming.get(token.name);
    if (studioToken && !next) {
      missing.push(token.name);
    }
    if (!studioToken || !next) {
      continue;
    }
    known.add(token.name);
    const file = open(token.file);
    const def = file.groups[token.group][token.name];
    const same = studioToken.type === "boxShadow" ? sameShadow : sameColor;
    const update = (current, value) => {
      if (value === undefined) {
        return current;
      }
      const text =
        studioToken.type === "boxShadow" ? shadowToCss(value) : String(value);
      const equal =
        studioToken.type === "boxShadow" || studioToken.type === "color"
          ? same(current, text)
          : current === text;
      return equal ? current : text;
    };
    let value;
    if (typeof def.value === "object") {
      value = {
        light: update(def.value.light, next.light ?? next.base),
        dark: update(def.value.dark, next.dark ?? next.base),
      };
    } else if (next.light !== undefined && next.dark !== undefined) {
      const light = update(def.value, next.light);
      const dark = update(def.value, next.dark);
      value = light === dark ? light : { light, dark };
    } else {
      value = update(def.value, next.base);
    }
    if (JSON.stringify(value) !== JSON.stringify(def.value)) {
      def.value = value;
      file.dirty = true;
      changed.push(token.name);
    }
  }
  const added = [];
  const ignored = [];
  const defined = new Set(tokens.map(token => token.name));
  for (const [name, entry] of incoming) {
    if (known.has(name)) {
      continue;
    }
    if (defined.has(name)) {
      ignored.push({ name, reason: "it is defined in code with a computed value" });
      continue;
    }
    const result = fromStudio(name, entry);
    if (result.reason) {
      ignored.push({ name, reason: result.reason });
      continue;
    }
    const file = open(fileForNewToken(name));
    file.groups[entry.group] ??= {};
    file.groups[entry.group][name] = { value: result.value };
    file.dirty = true;
    added.push(name);
  }

  for (const file of files.values()) {
    if (file.dirty) {
      writeFileSync(file.path, formatTokensFile(file.groups));
    }
  }
  return { changed, added, missing, ignored };
}
