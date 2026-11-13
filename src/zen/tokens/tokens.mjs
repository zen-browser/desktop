/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

export const TOKENS_DIR = import.meta.dirname;

// A token listed under "versatile-color" is a color that may paint any part of
// an element, the same way Firefox treats `--color-accent-primary`.
const CATEGORY_GROUPS = {
  "versatile-color": [
    "background-color",
    "border-color",
    "text-color",
    "icon-color",
  ],
};

function tokenFiles(dir = TOKENS_DIR) {
  return readdirSync(dir, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap(entry => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        return tokenFiles(path);
      }
      return entry.name.endsWith(".tokens.json") ? [path] : [];
    });
}

/** @returns {ZenToken[]} */
export function loadZenTokens() {
  const tokens = [];
  const seen = new Map();
  for (const path of tokenFiles()) {
    const file = relative(TOKENS_DIR, path).split(sep).join("/");
    const groups = JSON.parse(readFileSync(path, "utf8"));
    for (const [group, entries] of Object.entries(groups)) {
      if (group.startsWith("$")) {
        continue;
      }
      for (const [tokenName, def] of Object.entries(entries)) {
        if (!/^--[a-z0-9-]+$/.test(tokenName)) {
          throw new Error(
            `${file}: "${tokenName}" is not a custom property name`
          );
        }
        if (seen.has(tokenName)) {
          throw new Error(
            `${file}: ${tokenName} is already defined in ${seen.get(tokenName)}`
          );
        }
        seen.set(tokenName, file);
        const isExternal = def.external === true;
        if (isExternal === (def.value !== undefined)) {
          throw new Error(
            `${file}: ${tokenName} needs either a "value" or "external": true`
          );
        }
        tokens.push({
          name: tokenName,
          file,
          group,
          categories: [
            ...(CATEGORY_GROUPS[group] ?? [group]),
            ...(def.also ?? []),
          ],
          value: def.value,
          external: isExternal,
        });
      }
    }
  }
  return tokens;
}

/**
 * The value of a token as it is written in CSS.
 *
 * @param {ZenToken} token
 * @returns {string}
 */
export function cssValue(token) {
  if (typeof token.value === "object") {
    return `light-dark(${token.value.light}, ${token.value.dark})`;
  }
  return token.value;
}

/**
 * Returns a copy of Firefox's semantic categories table with Zen's tokens
 * appended to the categories they belong to.
 *
 * @param {Record<string, {name: string, value: unknown}[]>} tokensTable
 */
export function mergeZenTokens(tokensTable) {
  const merged = Object.fromEntries(
    Object.entries(tokensTable).map(([category, tokens]) => [
      category,
      [...tokens],
    ])
  );
  for (const token of loadZenTokens()) {
    for (const category of token.categories) {
      if (!merged[category]) {
        throw new Error(
          `${token.file}: ${token.name} uses unknown category "${category}"`
        );
      }
      merged[category].push({
        name: token.name,
        value: token.external ? {} : cssValue(token),
      });
    }
  }
  return merged;
}
