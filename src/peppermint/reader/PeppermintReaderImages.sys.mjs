/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Makes a saved article's pictures available offline.
 *
 * Reader Mode sanitizes the article HTML before showing it, and that drops
 * `data:` image sources (they would inherit the page's principal). The
 * pictures are therefore kept in a `data-peppermint-src` attribute, which the
 * sanitizer leaves alone, and the reader page copies it back into `src` once
 * the content is in place. The original `src` stays, so the page still shows
 * the live picture while online.
 */

import { clearTimeout, setTimeout } from "resource://gre/modules/Timer.sys.mjs";

const PREF_INLINE = "peppermint.reader.offline.inline-images";
const PREF_MAX_IMAGE_BYTES = "peppermint.reader.offline.max-image-bytes";
const PREF_MAX_ARTICLE_BYTES = "peppermint.reader.offline.max-article-bytes";

const DEFAULT_MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const DEFAULT_MAX_ARTICLE_BYTES = 12 * 1024 * 1024;
const CONCURRENCY = 4;
const FETCH_TIMEOUT_MS = 10000;
const BASE64_CHUNK = 0x8000;

export const OFFLINE_SRC_ATTRIBUTE = "data-peppermint-src";

function bytesToBase64(bytes) {
  let binary = "";
  for (let index = 0; index < bytes.length; index += BASE64_CHUNK) {
    binary += String.fromCharCode(
      ...bytes.subarray(index, index + BASE64_CHUNK)
    );
  }
  return btoa(binary);
}

/**
 * @param {string} src
 * @param {string} baseURL
 * @returns {string|null} An absolute http, https or file URL
 */
function resolveImageUrl(src, baseURL) {
  const url = URL.parse(src, baseURL);
  if (!url || !["http:", "https:", "file:"].includes(url.protocol)) {
    return null;
  }
  return url.href;
}

/**
 * @param {string} url
 * @param {string} referrer
 * @param {number} maxBytes
 * @returns {Promise<string|null>} A data URI, or null when the picture could
 *   not be fetched, is not an image or is over the size limit
 */
async function fetchAsDataUri(url, referrer, maxBytes) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      credentials: "omit",
      referrer,
      signal: controller.signal,
    });
    if (!response.ok) {
      return null;
    }
    const type = (response.headers.get("content-type") || "")
      .split(";")[0]
      .trim()
      .toLowerCase();
    if (!type.startsWith("image/")) {
      return null;
    }
    const declared = Number(response.headers.get("content-length"));
    if (declared > maxBytes) {
      return null;
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (!bytes.length || bytes.length > maxBytes) {
      return null;
    }
    return `data:${type};base64,${bytesToBase64(bytes)}`;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Run `task` over `items`, `limit` at a time.
 *
 * @param {object[]} items
 * @param {number} limit - How many tasks run at once
 * @param {(item: object) => Promise<void>} task
 */
async function forEachLimited(items, limit, task) {
  let next = 0;
  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (next < items.length) {
        await task(items[next++]);
      }
    }
  );
  await Promise.all(workers);
}

/**
 * Store each picture of an article as a data URI next to its original source.
 *
 * Pictures that cannot be fetched, are not images or do not fit the size
 * limits keep only their original source and need the network to show.
 *
 * @param {object} article - A parsed Reader article
 * @returns {Promise<{article: object, inlined: number, skipped: number}>} A
 *   copy of the article with `content` rewritten
 */
export async function inlineArticleImages(article) {
  const result = { article, inlined: 0, skipped: 0 };
  if (!Services.prefs.getBoolPref(PREF_INLINE, true) || !article?.content) {
    return result;
  }

  const maxImageBytes = Services.prefs.getIntPref(
    PREF_MAX_IMAGE_BYTES,
    DEFAULT_MAX_IMAGE_BYTES
  );
  // Leave room for the text; the store refuses articles over this size.
  let budget =
    Services.prefs.getIntPref(
      PREF_MAX_ARTICLE_BYTES,
      DEFAULT_MAX_ARTICLE_BYTES
    ) -
    article.content.length * 2;

  const doc = new DOMParser().parseFromString(
    `<!doctype html><body>${article.content}</body>`,
    "text/html"
  );
  const baseURL = article.url;

  const pending = [];
  for (const img of doc.querySelectorAll("img")) {
    const src = img.getAttribute("src") || "";
    if (/^data:image\//i.test(src)) {
      // Already inline, but Reader Mode would drop it.
      img.setAttribute(OFFLINE_SRC_ATTRIBUTE, src);
      result.inlined++;
      budget -= src.length;
      continue;
    }
    const url = resolveImageUrl(src, baseURL);
    if (url) {
      img.setAttribute("src", url);
      pending.push({ img, url });
    }
  }

  // The same picture often appears more than once (icons, avatars).
  const fetched = new Map();
  await forEachLimited(pending, CONCURRENCY, async ({ img, url }) => {
    if (budget <= 0) {
      result.skipped++;
      return;
    }
    if (!fetched.has(url)) {
      fetched.set(url, fetchAsDataUri(url, baseURL, maxImageBytes));
    }
    const dataUri = await fetched.get(url);
    if (!dataUri || dataUri.length > budget) {
      result.skipped++;
      return;
    }
    budget -= dataUri.length;
    img.setAttribute(OFFLINE_SRC_ATTRIBUTE, dataUri);
    // These would win over the picture that was stored.
    img.removeAttribute("srcset");
    img.removeAttribute("sizes");
    for (const source of img.parentElement?.localName === "picture"
      ? img.parentElement.querySelectorAll("source")
      : []) {
      source.remove();
    }
    result.inlined++;
  });

  result.article = { ...article, content: doc.body.innerHTML };
  return result;
}
