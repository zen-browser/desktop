// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import {
  MAX_REMOTE_FILES,
  pathParts,
} from "resource:///modules/zen/mods/ZenModsFiles.sys.mjs";

/*
 * What a mod from the store or GitHub may load: only its own files. Reads
 * its stylesheets, and the documents they point at, the way Gecko does.
 */

// Functions whose strings are URLs the style system loads.
const URL_FUNCTIONS = new Set([
  "url",
  "src",
  "image",
  "image-set",
  "-webkit-image-set",
  "cross-fade",
  "-moz-image-rect",
]);
// What a page sheet may load: nothing that can fetch on its behalf.
const LOCAL_PROTOCOLS = new Set(["data:", "chrome:", "resource:", "moz-icon:"]);
// Values only known once the page applies them.
const DEFERRED_FUNCTIONS = new Set(["var", "env", "attr"]);
// At-rules whose URLs say where they apply, not what they load.
const MATCHING_AT_RULES = new Set(["namespace", "-moz-document", "document"]);
const CHARSET_RE = /^@charset "([^"]*)";/;
// Files a sheet may point at that Gecko never reads as a document.
const PLAIN_FILE_RE = /\.(?:png|jpe?g|gif|webp|avif|ico|bmp|woff2?|ttf|otf)$/i;
const DTD_RE = /<!ENTITY|<!DOCTYPE[^>]*\b(?:SYSTEM|PUBLIC)\b/i;
const XML_ENCODING_RE = /^\s*<\?xml\b[^>]*\bencoding\s*=\s*["']([^"']*)["']/;
const SVG_NS = "http://www.w3.org/2000/svg";
// What could reach past an SVG document: HTML with its own links, or
// animations that change a link once it's checked.
const SVG_UNSAFE_ELEMENTS = new Set([
  "script",
  "foreignObject",
  "set",
  "animate",
  "animateMotion",
  "animateTransform",
  "discard",
]);
const CLOSING_TOKENS = new Set([
  "CloseParenthesis",
  "CloseSquareBracket",
  "CloseCurlyBracket",
]);
// Stands in for where a mod's page sheet loads from, to resolve its URLs. Its
// folder is the mod's: past it lie the profile's own sheets.
const SHEET_ROOT = "/mod/";
const SHEET_BASE = `resource://zen-mod${SHEET_ROOT}`;

/**
 * Lists the URLs a stylesheet loads, the way Gecko's own lexer reads them,
 * escapes and all: unquoted `url()`s, and the strings in `url()`,
 * `image-set()` and the like, and in `@import`.
 *
 * @param {string} text
 * @param {Window} win - Where the lexer lives
 * @returns {{url: string|null, isImport: boolean}[]} A null url is one that
 * can't be known here: unreadable, or given by var(), env() or attr()
 */
function cssUrls(text, win) {
  const parser = new win.InspectorCSSParser(text);
  const blocks = [];
  const urls = [];
  let isImport = false;
  let isMatching = false;

  for (let token = parser.nextToken(); token; token = parser.nextToken()) {
    switch (token.tokenType) {
      case "AtKeyword": {
        const name = token.value.toLowerCase();

        isImport = name === "import";
        isMatching = MATCHING_AT_RULES.has(name);
        break;
      }

      case "Semicolon": {
        isImport = false;
        isMatching = false;
        break;
      }

      case "Function": {
        const name = token.value.toLowerCase();

        // A URL that comes from elsewhere can't be checked here.
        if (
          !isMatching &&
          DEFERRED_FUNCTIONS.has(name) &&
          blocks.some(block => URL_FUNCTIONS.has(block))
        ) {
          urls.push({ url: null, isImport });
        }

        blocks.push(name);
        break;
      }

      case "ParenthesisBlock":
      case "SquareBracketBlock":
      case "CurlyBracketBlock": {
        isImport = false;
        isMatching &&= token.tokenType !== "CurlyBracketBlock";
        blocks.push("");
        break;
      }

      case "UnquotedUrl": {
        if (!isMatching) {
          urls.push({ url: token.value, isImport });
        }
        break;
      }

      case "BadUrl": {
        if (!isMatching) {
          urls.push({ url: null, isImport });
        }
        break;
      }

      case "QuotedString": {
        if (
          !isMatching &&
          (isImport || blocks.some(name => URL_FUNCTIONS.has(name)))
        ) {
          urls.push({ url: token.value, isImport });
        }
        break;
      }

      default: {
        if (CLOSING_TOKENS.has(token.tokenType)) {
          blocks.pop();
        }
      }
    }
  }

  return urls;
}

/**
 * @param {string} folder - A mod's folder
 * @param {string} entry - One of its stylesheets
 * @returns {Promise<boolean>} Whether that sheet, or one it imports, loads
 * anything that isn't the mod's own. A sheet that can't be read or checked
 * counts as one that does; one the mod lacks loads nothing.
 */
async function hasRemoteStyles(folder, entry) {
  const win =
    Services.wm.getMostRecentWindow("navigator:browser") ??
    Services.appShell.hiddenDOMWindow;
  const queue = [entry];
  const seen = new Set();
  const documents = new Set();

  while (queue.length) {
    const relative = queue.shift();

    if (seen.has(relative)) {
      continue;
    }

    seen.add(relative);

    const parts = pathParts(relative);

    if (!parts || seen.size > MAX_REMOTE_FILES) {
      return true;
    }

    let text;

    try {
      const path = PathUtils.join(folder, ...parts);

      // Gecko resolves the import the same way, and finds nothing either.
      if (!(await IOUtils.exists(path))) {
        continue;
      }

      text = await IOUtils.readUTF8(path);
    } catch {
      return true;
    }

    // Gecko reads a sheet that names another encoding with it, where a
    // string may end somewhere else than it does here.
    const charset = text.match(CHARSET_RE)?.[1];

    if (charset) {
      try {
        if (new TextDecoder(charset).encoding !== "utf-8") {
          return true;
        }
      } catch {
        // Gecko ignores labels it doesn't know, like this does.
      }
    }

    for (const { url, isImport } of cssUrls(text, win)) {
      // Zen's own sheets load from file:, which reads a backslash as a
      // slash; the stand-in here doesn't.
      if (url === null || url.includes("\\")) {
        return true;
      }

      const target = URL.parse(url, `${SHEET_BASE}${relative}`);

      if (!target) {
        return true;
      }

      if (URL.canParse(url)) {
        // Imports bring more CSS: only the mod's own, which is checked too.
        // A data: sheet, say, would come in unchecked.
        if (isImport || !LOCAL_PROTOCOLS.has(target.protocol)) {
          return true;
        }

        continue;
      }

      // A relative URL may only reach the mod's own files. Past them lie
      // every mod's sheets, the disk, and through "//" the network.
      if (
        target.host !== "zen-mod" ||
        !target.pathname.startsWith(SHEET_ROOT)
      ) {
        return true;
      }

      let path;

      try {
        path = decodeURIComponent(target.pathname.slice(SHEET_ROOT.length));
      } catch {
        return true;
      }

      if (isImport) {
        queue.push(path);
      } else if (!PLAIN_FILE_RE.test(path)) {
        documents.add(path);
      }
    }
  }

  for (const path of documents) {
    const parts = pathParts(path);

    if (
      !parts ||
      (await documentLoads(PathUtils.join(folder, ...parts), win))
    ) {
      return true;
    }
  }

  return false;
}

/**
 * An SVG or other document a sheet points at, as a filter, a mask and the
 * like, loads its own stylesheets: in Zen's windows those reach the web.
 * Only references within the document itself pass.
 *
 * @param {string} path - A file of the mod
 * @param {Window} win - Where the parsers live
 * @returns {Promise<boolean>} Whether it may load anything
 */
async function documentLoads(path, win) {
  let text;

  try {
    if (!(await IOUtils.exists(path))) {
      return false;
    }

    text = await IOUtils.readUTF8(path);
  } catch {
    return true;
  }

  // Gecko reads a document that names another encoding with it, where a
  // string may end somewhere else than it does here.
  const encoding = text.match(XML_ENCODING_RE)?.[1];

  if (encoding) {
    try {
      if (new TextDecoder(encoding).encoding !== "utf-8") {
        return true;
      }
    } catch {
      // Gecko doesn't load a document in an encoding it doesn't know.
    }
  }

  const doc = new win.DOMParser().parseFromString(text, "image/svg+xml");
  const isOwn = value => value.trim().startsWith("#");
  const cssLoads = css =>
    cssUrls(css, win).some(
      ({ url, isImport }) => isImport || !isOwn(url ?? "")
    );

  if (
    DTD_RE.test(text) ||
    doc.documentElement.localName === "parsererror" ||
    [...doc.childNodes].some(
      node => node.nodeType === node.PROCESSING_INSTRUCTION_NODE
    )
  ) {
    return true;
  }

  for (const element of doc.getElementsByTagName("*")) {
    if (
      element.namespaceURI !== SVG_NS ||
      SVG_UNSAFE_ELEMENTS.has(element.localName) ||
      (element.localName === "style" && cssLoads(element.textContent))
    ) {
      return true;
    }

    for (const { localName, value } of element.attributes) {
      const isLink = localName === "href" || localName === "src";

      if (
        (isLink && !isOwn(value)) ||
        (value.includes("(") && cssLoads(value))
      ) {
        return true;
      }
    }
  }

  return false;
}

/**
 * What a mod from the store or GitHub may not do: load styles, fonts or
 * images from the web. Those can change after the mod is reviewed, and with
 * selectors on what's on screen, tell their server about it.
 */
export class RemoteStylesError extends Error {
  name = "RemoteStylesError";
}

/**
 * @param {string} folder - A mod's folder
 * @param {string} name - The mod's name
 * @param {(string|null)[]} entries - Its stylesheets, if it has them
 */
export async function assertLocalStyles(folder, name, entries) {
  for (const entry of entries) {
    if (entry && (await hasRemoteStyles(folder, entry))) {
      throw new RemoteStylesError(
        `[ZenMods]: ${entry} of ${name} loads from the web; mods may only use their own files.`
      );
    }
  }
}
