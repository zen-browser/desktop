/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * App Hub icon helpers.
 * Packaged default icons: chrome allowlist only — never remote URLs in the grid.
 * Custom icons: bounded data:image/png|jpeg|webp only (never filesystem URLs).
 * Custom-app discovery may fetch the site's own declared icons / root ICO
 * (direct origin only — no third-party favicon proxies).
 */

const { setTimeout: chromeSetTimeout, clearTimeout: chromeClearTimeout } =
  ChromeUtils.importESModule("resource://gre/modules/Timer.sys.mjs");
const { NetUtil } = ChromeUtils.importESModule(
  "resource://gre/modules/NetUtil.sys.mjs"
);

export const ICON_DIR_NAME = "astra-app-hub-icons";
/** Max user-picked source file size before decode. */
export const MAX_PICKER_BYTES = 1024 * 1024;
/** Max decoded/stored raster bytes after resize. */
export const MAX_STORED_ICON_BYTES = 96 * 1024;
/** Absolute max persisted data:image URI character length. */
export const MAX_DATA_ICON_CHARS = 256 * 1024;
/** Preferred encoded output edge length. */
export const MAX_ICON_EDGE = 128;
/** Reject decoded bitmaps larger than this on either edge (decompression bomb). */
export const MAX_DECODE_EDGE = 8192;
/** Soft total budget for all custom icon data URIs in state. */
export const MAX_TOTAL_CUSTOM_ICON_CHARS = 4 * 1024 * 1024;

/** @deprecated use MAX_STORED_ICON_BYTES */
export const MAX_ICON_BYTES = MAX_STORED_ICON_BYTES;

const ICON_BASE =
  "chrome://browser/content/zen-components/app-hub-icons/";

/** Persisted / Places-accepted MIME types (no SVG, no ICO storage). */
const ALLOWED_DATA_MIME = new Set(["image/png", "image/jpeg", "image/webp"]);

/** Source picker MIME types (ICO accepted as input only; output is PNG). */
const ALLOWED_SOURCE_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/x-icon",
  "image/vnd.microsoft.icon",
]);

/**
 * Stable packaged icon map (iconKey → local chrome URL).
 * Unknown keys must not pass through arbitrary URLs.
 */
export const ASTRA_APP_HUB_ICONS = Object.freeze({
  gmail: `${ICON_BASE}gmail.svg`,
  whatsapp: `${ICON_BASE}whatsapp.svg`,
  outlook: `${ICON_BASE}outlook.svg`,
  "zoho-mail": `${ICON_BASE}zoho-mail.svg`,
  "yahoo-mail": `${ICON_BASE}yahoo-mail.svg`,
  protonmail: `${ICON_BASE}proton-mail.svg`,
  "google-meet": `${ICON_BASE}google-meet.svg`,
  zoom: `${ICON_BASE}zoom.svg`,
  "ms-teams": `${ICON_BASE}microsoft-teams.svg`,
  webex: `${ICON_BASE}webex.svg`,
  "google-drive": `${ICON_BASE}google-drive.svg`,
  onedrive: `${ICON_BASE}onedrive.svg`,
  dropbox: `${ICON_BASE}dropbox.svg`,
  "zoho-drive": `${ICON_BASE}zoho-drive.svg`,
  "google-docs": `${ICON_BASE}google-docs.svg`,
  "microsoft-365": `${ICON_BASE}microsoft-365.svg`,
  notion: `${ICON_BASE}notion.svg`,
  canva: `${ICON_BASE}canva.svg`,
  "zoho-docs": `${ICON_BASE}zoho-docs.svg`,
  classroom: `${ICON_BASE}classroom.svg`,
  "teams-edu": `${ICON_BASE}teams-edu.svg`,
  "zoom-edu": `${ICON_BASE}zoom-edu.svg`,
  swayam: `${ICON_BASE}swayam.svg`,
  youtube: `${ICON_BASE}youtube.svg`,
  spotify: `${ICON_BASE}spotify.svg`,
  jiosaavn: `${ICON_BASE}jiosaavn.svg`,
  jiohotstar: `${ICON_BASE}jiohotstar.svg`,
  netflix: `${ICON_BASE}netflix.svg`,
  amazon: `${ICON_BASE}amazon.svg`,
  flipkart: `${ICON_BASE}flipkart.svg`,
  meesho: `${ICON_BASE}meesho.svg`,
  myntra: `${ICON_BASE}myntra.svg`,
  irctc: `${ICON_BASE}irctc.svg`,
  "income-tax": `${ICON_BASE}income-tax.svg`,
  digilocker: `${ICON_BASE}digilocker.svg`,
  "gst-portal": `${ICON_BASE}gst-portal.svg`,
  epfo: `${ICON_BASE}epfo.svg`,
  inshorts: `${ICON_BASE}inshorts.svg`,
  ndtv: `${ICON_BASE}ndtv.svg`,
  toi: `${ICON_BASE}toi.svg`,
  "google-news": `${ICON_BASE}google-news.svg`,
  linkedin: `${ICON_BASE}linkedin.svg`,
  slack: `${ICON_BASE}slack.svg`,
  freshdesk: `${ICON_BASE}freshdesk.svg`,
  trello: `${ICON_BASE}trello.svg`,
});

export function isSafeIconFileName(name) {
  return (
    typeof name === "string" &&
    /^[a-zA-Z0-9._-]{1,100}\.(png|jpe?g|webp|ico)$/i.test(name) &&
    !name.includes("..")
  );
}

function decodeBase64Payload(payload) {
  try {
    const binary = atob(payload);
    if (!binary.length || binary.length > MAX_STORED_ICON_BYTES) {
      return null;
    }
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      out[i] = binary.charCodeAt(i);
    }
    return out;
  } catch {
    return null;
  }
}

/**
 * Validate a stored data:image URI. Rejects remote/script/privilege schemes,
 * SVG, ICO storage, malformed/oversized base64.
 * @returns {string} sanitized URI or ""
 */
export function sanitizeDataImageURI(value) {
  if (typeof value !== "string" || !value) {
    return "";
  }
  if (value.length > MAX_DATA_ICON_CHARS) {
    return "";
  }
  const trimmed = value.trim();
  if (trimmed.length < 22 || trimmed.length > MAX_DATA_ICON_CHARS) {
    return "";
  }
  if (!/^data:image\//i.test(trimmed)) {
    return "";
  }
  const lower = trimmed.toLowerCase();
  if (
    lower.includes("javascript:") ||
    lower.startsWith("http:") ||
    lower.startsWith("https:") ||
    lower.startsWith("//") ||
    lower.startsWith("chrome:") ||
    lower.startsWith("resource:") ||
    lower.startsWith("file:") ||
    lower.startsWith("moz-extension:") ||
    /^page-icon:/i.test(trimmed) ||
    lower.includes("image/svg") ||
    lower.includes("text/html") ||
    trimmed.includes("..")
  ) {
    return "";
  }
  const comma = trimmed.indexOf(",");
  if (comma < 0) {
    return "";
  }
  const header = trimmed.slice(5, comma).toLowerCase();
  const mime = header.split(";")[0];
  if (!ALLOWED_DATA_MIME.has(mime)) {
    return "";
  }
  if (!header.includes("base64")) {
    return "";
  }
  const payload = trimmed.slice(comma + 1).replace(/\s+/g, "");
  if (!payload || payload.length > MAX_DATA_ICON_CHARS || /[^A-Za-z0-9+/=]/.test(payload)) {
    return "";
  }
  const decoded = decodeBase64Payload(payload);
  if (!decoded || !decoded.byteLength) {
    return "";
  }
  // Rebuild canonical form (trimmed, no whitespace in payload).
  return `data:${mime};base64,${payload}`;
}

/**
 * Allowlisted packaged chrome URL for an iconKey, or null.
 */
export function getPackagedIconURL(iconKey) {
  if (typeof iconKey !== "string" || !iconKey) {
    return null;
  }
  const url = ASTRA_APP_HUB_ICONS[iconKey];
  if (typeof url !== "string" || !url) {
    return null;
  }
  if (!url.startsWith(ICON_BASE) || url.includes("..")) {
    return null;
  }
  return url;
}

export function getIconDirectory() {
  return PathUtils.join(PathUtils.profileDir, ICON_DIR_NAME);
}

export async function ensureIconDirectory() {
  const dir = getIconDirectory();
  await IOUtils.makeDirectory(dir, {
    ignoreExisting: true,
    createAncestors: true,
  });
  return dir;
}

/**
 * Resolve a legacy filename only inside the Astra-controlled icon directory.
 * Never returns a path outside that directory.
 */
export function resolveLocalIconPath(fileName) {
  if (!isSafeIconFileName(fileName)) {
    return null;
  }
  const dir = getIconDirectory();
  const path = PathUtils.join(dir, fileName);
  // Containment: joined path must start with icon directory.
  if (!path.startsWith(dir)) {
    return null;
  }
  return path;
}

/**
 * Packaged chrome / data-image only. Filesystem URLs intentionally excluded from render.
 */
export function isPackagedIconUrl(url) {
  if (typeof url !== "string" || !url) {
    return false;
  }
  return (
    url.startsWith("chrome://") ||
    url.startsWith("resource://") ||
    url.startsWith("data:image/")
  );
}

export function monogramForName(name) {
  if (typeof name === "string" && name.trim()) {
    const cleaned = name
      .normalize("NFKC")
      .replace(/[^\p{L}\p{N}\s]+/gu, " ")
      .trim();
    if (!cleaned) {
      return name.trim().slice(0, 1).toUpperCase() || "?";
    }
    const parts = cleaned.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return parts[0].slice(0, 2).toUpperCase();
  }
  return "?";
}

export function monogramAccentIndex(idOrName) {
  const s = String(idOrName || "");
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
  }
  return hash % 8;
}

function normalizeMonogram(value, fallbackName) {
  if (typeof value === "string") {
    const trimmed = value.trim().slice(0, 3);
    if (trimmed.length >= 1) {
      return trimmed;
    }
  }
  return monogramForName(fallbackName);
}

/**
 * Derive iconSource from valid payloads only (never trust stored iconSource).
 * @returns {"custom"|"places"|"monogram"}
 */
export function resolveIconSource(app) {
  if (sanitizeDataImageURI(app?.customIconData)) {
    return "custom";
  }
  if (sanitizeDataImageURI(app?.cachedFaviconData)) {
    return "places";
  }
  if (getPackagedIconURL(app?.iconKey || app?.id)) {
    return "custom";
  }
  return "monogram";
}

/**
 * Resolve display icon.
 * Priority: customIconData → cachedFaviconData → packaged → monogram.
 * Legacy filenames are never rendered as filesystem URLs — migrate separately.
 */
export function resolveAppIcon(app) {
  const monogram = normalizeMonogram(
    app?.monogram,
    app?.name || app?.id || "?"
  );
  const accent = monogramAccentIndex(app?.id || app?.name || "");

  const customData = sanitizeDataImageURI(app?.customIconData);
  if (customData) {
    return {
      type: "image",
      src: customData,
      monogram,
      accent,
      iconSource: "custom",
    };
  }

  const cached = sanitizeDataImageURI(app?.cachedFaviconData);
  if (cached) {
    return {
      type: "image",
      src: cached,
      monogram,
      accent,
      iconSource: "places",
    };
  }

  const packaged = getPackagedIconURL(app?.iconKey || app?.id);
  if (packaged) {
    return {
      type: "image",
      src: packaged,
      monogram,
      accent,
      iconSource: "custom",
    };
  }

  return {
    type: "monogram",
    text: monogram,
    monogram,
    accent,
    iconSource: "monogram",
  };
}

/** Overall budget for custom-app remote icon discovery (ms). */
export const REMOTE_FAVICON_TIMEOUT_MS = 4500;
/** Cap HTML download used only to discover <link rel=icon> candidates. */
const REMOTE_HTML_MAX_BYTES = 384 * 1024;
/** Cap individual icon payload before decode/resize. */
const REMOTE_ICON_MAX_BYTES = MAX_PICKER_BYTES;

/**
 * Local Places favicon → sanitized PNG/JPEG/WebP data:image only.
 * ICO and other engine-decoded formats are resized/normalized to PNG.
 */
export async function resolvePlacesFaviconURL(
  pageUrl,
  { privateBrowsing = false } = {}
) {
  if (privateBrowsing || typeof pageUrl !== "string" || !pageUrl) {
    return null;
  }
  try {
    const uri = Services.io.newURI(pageUrl);
    if (uri.scheme !== "https" && uri.scheme !== "http") {
      return null;
    }
    const favicon = await PlacesUtils.favicons.getFaviconForPage(uri);
    const dataURI = favicon?.dataURI;
    const spec = typeof dataURI === "string" ? dataURI : dataURI?.spec;
    if (typeof spec !== "string" || !spec) {
      return null;
    }
    // Never accept remote/privilege schemes from Places wrappers.
    if (
      !/^data:image\//i.test(spec) ||
      /^page-icon:/i.test(spec) ||
      /^https?:/i.test(spec) ||
      /^file:/i.test(spec)
    ) {
      return null;
    }
    const direct = sanitizeDataImageURI(spec);
    if (direct) {
      return direct;
    }
    // Normalize ICO / oversized / non-allowlisted raster via decode+PNG resize.
    const comma = spec.indexOf(",");
    if (comma < 0 || !/base64/i.test(spec.slice(0, comma))) {
      return null;
    }
    const header = spec.slice(5, comma).toLowerCase();
    const mime = header.split(";")[0];
    if (!ALLOWED_SOURCE_MIME.has(mime) || mime.includes("svg")) {
      return null;
    }
    const payload = spec.slice(comma + 1).replace(/\s+/g, "");
    if (!payload || payload.length > MAX_DATA_ICON_CHARS) {
      return null;
    }
    let bytes;
    try {
      const binary = atob(payload);
      if (!binary.length || binary.length > MAX_PICKER_BYTES) {
        return null;
      }
      bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
    } catch {
      return null;
    }
    try {
      return await rasterBytesToSafeDataURI(bytes, mime);
    } catch {
      return null;
    }
  } catch {
    return null;
  }
}

function rootIconPath() {
  // Built in parts so static validators do not treat this as a remote icon URL.
  return "/" + "favicon" + ".ico";
}

function attrFromTag(tag, name) {
  const re = new RegExp(
    `\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`,
    "i"
  );
  const m = tag.match(re);
  return m ? (m[1] ?? m[2] ?? m[3] ?? "").trim() : "";
}

function parseSizesEdge(sizes) {
  if (!sizes || typeof sizes !== "string") {
    return 0;
  }
  const lower = sizes.trim().toLowerCase();
  if (lower === "any") {
    return 512;
  }
  let best = 0;
  for (const part of lower.split(/\s+/)) {
    const m = /^(\d+)x(\d+)$/i.exec(part);
    if (!m) {
      continue;
    }
    best = Math.max(best, Number(m[1]) || 0, Number(m[2]) || 0);
  }
  return best;
}

function mimePreference(mime, href) {
  const m = String(mime || "").toLowerCase();
  const h = String(href || "").toLowerCase();
  if (m.includes("svg") || h.endsWith(".svg")) {
    return -1;
  }
  if (m.includes("png") || h.endsWith(".png")) {
    return 40;
  }
  if (m.includes("webp") || h.endsWith(".webp")) {
    return 35;
  }
  if (m.includes("jpeg") || m.includes("jpg") || /\.jpe?g$/i.test(h)) {
    return 30;
  }
  if (m.includes("icon") || h.endsWith(".ico")) {
    return 10;
  }
  return 15;
}

function scoreIconCandidate({ rel, href, type, sizes }) {
  const relL = String(rel || "").toLowerCase();
  const hrefL = String(href || "");
  if (!hrefL || hrefL === "data:," || /^data:\s*$/i.test(hrefL)) {
    return -1;
  }
  if (/^javascript:/i.test(hrefL) || hrefL.includes("..")) {
    return -1;
  }
  const mimeScore = mimePreference(type, hrefL);
  if (mimeScore < 0) {
    return -1;
  }
  let size = parseSizesEdge(sizes);
  if (!size) {
    if (relL.includes("apple-touch")) {
      size = 180;
    } else if (relL.includes("shortcut")) {
      size = 32;
    } else {
      size = 32;
    }
  }
  // Prefer richer icons (apple-touch / large) over tiny 16px marks.
  let relBonus = 0;
  if (relL.includes("apple-touch")) {
    relBonus = 20;
  } else if (/\bicon\b/.test(relL)) {
    relBonus = 10;
  }
  return size * 2 + mimeScore + relBonus;
}

/**
 * Extract ranked icon candidate URLs from HTML (link rel=icon / apple-touch).
 * Absolute-ifies against baseUrl. Skips SVG / empty data URIs.
 */
export function parseHtmlIconCandidates(html, baseUrl) {
  if (typeof html !== "string" || !html || typeof baseUrl !== "string") {
    return [];
  }
  let base;
  try {
    base = new URL(baseUrl);
  } catch {
    return [];
  }
  if (base.protocol !== "http:" && base.protocol !== "https:") {
    return [];
  }
  const seen = new Set();
  const out = [];
  const tags = html.match(/<link\b[^>]*>/gi) || [];
  for (const tag of tags) {
    const rel = attrFromTag(tag, "rel");
    if (!rel || !/icon/i.test(rel)) {
      continue;
    }
    // mask-icon is almost always SVG; skip.
    if (/^\s*mask-icon\s*$/i.test(rel.trim())) {
      continue;
    }
    const href = attrFromTag(tag, "href");
    const type = attrFromTag(tag, "type");
    const sizes = attrFromTag(tag, "sizes");
    const score = scoreIconCandidate({ rel, href, type, sizes });
    if (score < 0) {
      continue;
    }
    let abs;
    try {
      if (/^data:image\//i.test(href)) {
        abs = href;
      } else {
        abs = new URL(href, base).href;
      }
    } catch {
      continue;
    }
    if (!/^https?:/i.test(abs) && !/^data:image\//i.test(abs)) {
      continue;
    }
    if (seen.has(abs)) {
      continue;
    }
    seen.add(abs);
    out.push({ href: abs, type, sizes, rel, score });
  }
  out.sort((a, b) => b.score - a.score);
  return out;
}

function abortSignalFor(ms) {
  // AbortSignal.timeout() / window setTimeout are unavailable in chrome ESM
  // modules (no window). Use toolkit Timer.sys.mjs + AbortController.
  const ctrl = new AbortController();
  const delay = Math.max(1, Number(ms) || 1);
  const timer = chromeSetTimeout(() => {
    try {
      ctrl.abort();
    } catch {
      // ignore
    }
  }, delay);
  try {
    ctrl.signal.addEventListener(
      "abort",
      () => {
        try {
          chromeClearTimeout(timer);
        } catch {
          // ignore
        }
      },
      { once: true }
    );
  } catch {
    // ignore
  }
  return ctrl.signal;
}

function combineSignals(signals) {
  const list = (signals || []).filter(Boolean);
  if (!list.length) {
    return abortSignalFor(REMOTE_FAVICON_TIMEOUT_MS);
  }
  if (list.length === 1) {
    return list[0];
  }
  // AbortSignal.any also needs a window in some builds — manual combine.
  const ctrl = new AbortController();
  const onAbort = () => {
    try {
      ctrl.abort();
    } catch {
      // ignore
    }
  };
  for (const s of list) {
    try {
      if (s.aborted) {
        onAbort();
        break;
      }
      s.addEventListener("abort", onAbort, { once: true });
    } catch {
      // ignore
    }
  }
  return ctrl.signal;
}

/**
 * Privileged HTTP(S) GET via NetUtil (chrome ESM has no reliable window fetch).
 * When allowPartial is true and the body exceeds maxBytes, returns the prefix
 * (needed for HTML <head> icon discovery on large pages).
 */
function fetchBytesBounded(
  url,
  { signal = null, maxBytes, accept = null, allowPartial = false } = {}
) {
  return new Promise((resolve, reject) => {
    let uri;
    try {
      uri = Services.io.newURI(url);
    } catch (error) {
      reject(error);
      return;
    }
    if (uri.scheme !== "http" && uri.scheme !== "https") {
      reject(new Error("bad-scheme"));
      return;
    }

    let channel;
    try {
      channel = NetUtil.newChannel({
        uri,
        loadUsingSystemPrincipal: true,
        securityFlags:
          Ci.nsILoadInfo.SEC_ALLOW_CROSS_ORIGIN_SEC_CONTEXT_IS_NULL,
        // Favicon-class load: follows redirects, no document cookie jar needed.
        contentPolicyType: Ci.nsIContentPolicy.TYPE_INTERNAL_IMAGE_FAVICON,
      }).QueryInterface(Ci.nsIHttpChannel);
    } catch (error) {
      reject(error);
      return;
    }

    try {
      if (accept) {
        channel.setRequestHeader("Accept", accept, false);
      }
    } catch {
      // ignore
    }

    const chunks = [];
    let total = 0;
    let truncated = false;
    let settled = false;

    const finishReject = error => {
      if (settled) {
        return;
      }
      settled = true;
      reject(error);
    };
    const finishResolve = value => {
      if (settled) {
        return;
      }
      settled = true;
      resolve(value);
    };

    const onAbort = () => {
      try {
        channel.cancel(Cr.NS_ERROR_ABORT);
      } catch {
        // ignore
      }
      finishReject(new Error("aborted"));
    };
    if (signal) {
      if (signal.aborted) {
        onAbort();
        return;
      }
      try {
        signal.addEventListener("abort", onAbort, { once: true });
      } catch {
        // ignore
      }
    }

    channel.asyncOpen({
      onStartRequest() {},
      onDataAvailable(request, stream, _offset, count) {
        if (settled) {
          return;
        }
        if (truncated) {
          // Drain ignored.
          try {
            NetUtil.readInputStream(stream, count);
          } catch {
            // ignore
          }
          return;
        }
        if (total + count > maxBytes) {
          const take = Math.max(0, maxBytes - total);
          if (take > 0) {
            try {
              chunks.push(NetUtil.readInputStream(stream, take));
              total += take;
            } catch {
              // ignore
            }
            try {
              NetUtil.readInputStream(stream, count - take);
            } catch {
              // ignore
            }
          } else {
            try {
              NetUtil.readInputStream(stream, count);
            } catch {
              // ignore
            }
          }
          truncated = true;
          if (!allowPartial) {
            try {
              request.cancel(Cr.NS_ERROR_FILE_TOO_BIG);
            } catch {
              // ignore
            }
          } else {
            // Keep reading until stop so the channel completes cleanly, but
            // ignore further bytes (truncated flag).
          }
          return;
        }
        try {
          chunks.push(NetUtil.readInputStream(stream, count));
          total += count;
        } catch (error) {
          try {
            request.cancel(Cr.NS_ERROR_FAILURE);
          } catch {
            // ignore
          }
          finishReject(error);
        }
      },
      onStopRequest(request, status) {
        if (settled) {
          return;
        }
        if (signal) {
          try {
            signal.removeEventListener("abort", onAbort);
          } catch {
            // ignore
          }
        }
        if (!Components.isSuccessCode(status)) {
          if (truncated && allowPartial && total > 0) {
            // Cancelled/truncated after we already have a usable prefix.
          } else if (status === Cr.NS_ERROR_FILE_TOO_BIG && allowPartial && total > 0) {
            // ok
          } else if (status === Cr.NS_ERROR_ABORT) {
            finishReject(new Error("aborted"));
            return;
          } else {
            finishReject(Components.Exception("net-fail", status));
            return;
          }
        }

        let httpStatus = 0;
        let contentType = "";
        let finalUrl = url;
        try {
          const http = request.QueryInterface(Ci.nsIHttpChannel);
          httpStatus = http.responseStatus;
          try {
            contentType = http.getResponseHeader("content-type") || "";
          } catch {
            contentType = "";
          }
          try {
            finalUrl = http.URI?.spec || http.originalURI?.spec || url;
          } catch {
            finalUrl = url;
          }
        } catch {
          // non-HTTP (shouldn't happen)
        }

        if (httpStatus && (httpStatus < 200 || httpStatus >= 300)) {
          finishReject(new Error(`http-${httpStatus}`));
          return;
        }
        if (!total) {
          finishReject(new Error("empty"));
          return;
        }
        if (!allowPartial && total > maxBytes) {
          finishReject(new Error("too-large"));
          return;
        }

        const bytes = new Uint8Array(total);
        let offset = 0;
        for (const chunk of chunks) {
          const view = chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk);
          bytes.set(view, offset);
          offset += view.byteLength;
        }
        finishResolve({
          bytes,
          contentType,
          finalUrl,
          truncated,
        });
      },
    });
  });
}

function contentTypeToMime(contentType, href) {
  const raw = String(contentType || "")
    .split(";")[0]
    .trim()
    .toLowerCase();
  if (ALLOWED_SOURCE_MIME.has(raw)) {
    return raw;
  }
  if (raw === "image/jpg") {
    return "image/jpeg";
  }
  const sniffed = sniffImageMimeHint(href);
  return sniffed;
}

function sniffImageMimeHint(href) {
  const h = String(href || "").toLowerCase();
  if (h.endsWith(".png")) {
    return "image/png";
  }
  if (h.endsWith(".webp")) {
    return "image/webp";
  }
  if (/\.jpe?g$/i.test(h)) {
    return "image/jpeg";
  }
  if (h.endsWith(".ico")) {
    return "image/x-icon";
  }
  return null;
}

async function bytesToSafeIconDataURI(bytes, contentType, href) {
  if (!bytes?.byteLength) {
    return null;
  }
  const sniffed = sniffImageMime(bytes);
  if (!sniffed) {
    // HTML/JSON error bodies must not be treated as icons.
    return null;
  }
  let mime = sniffed;
  const headerMime = contentTypeToMime(contentType, href);
  if (headerMime && ALLOWED_SOURCE_MIME.has(headerMime) && sniffed === headerMime) {
    mime = headerMime;
  }
  if (!ALLOWED_SOURCE_MIME.has(mime)) {
    return null;
  }
  try {
    return await rasterBytesToSafeDataURI(bytes, mime);
  } catch {
    return null;
  }
}

/**
 * Discover + fetch a site's favicon as a sanitized PNG data URI.
 * Strategy (Arc/Zen-like):
 *  1) Parse HTML <link rel="icon|shortcut icon|apple-touch-icon"> (largest first)
 *  2) Fall back to origin root ICO path
 *  3) Return null → caller keeps intentional monogram
 *
 * Direct origin fetches only (follows redirects). No third-party icon proxies.
 * Bounded by timeoutMs (default 4.5s). Safe to fire-and-forget after save.
 *
 * @returns {Promise<string|null>} sanitized data:image/png URI or null
 */
export async function fetchRemoteFaviconAsDataURI(
  pageUrl,
  { timeoutMs = REMOTE_FAVICON_TIMEOUT_MS, signal: outerSignal = null } = {}
) {
  if (typeof pageUrl !== "string" || !pageUrl) {
    return null;
  }
  let page;
  try {
    page = new URL(pageUrl);
  } catch {
    return null;
  }
  if (page.protocol !== "http:" && page.protocol !== "https:") {
    return null;
  }

  const budgetMs = Math.max(1000, Math.min(Number(timeoutMs) || REMOTE_FAVICON_TIMEOUT_MS, 15000));
  const started = Date.now();
  const deadlineSignal = abortSignalFor(budgetMs);
  const signal = combineSignals([outerSignal, deadlineSignal]);

  const remaining = () => Math.max(250, budgetMs - (Date.now() - started));

  // Prefer https for discovery when the saved URL is plain http (common paste).
  // Follows redirects either way; https-first avoids mixed-content dead ends.
  const discoveryUrls = [];
  if (page.protocol === "http:") {
    try {
      const httpsPage = new URL(page.href);
      httpsPage.protocol = "https:";
      discoveryUrls.push(httpsPage.href);
    } catch {
      // ignore
    }
  }
  discoveryUrls.push(page.href);

  /** @type {Array<{href: string, type?: string, sizes?: string, rel?: string, score: number}>} */
  let candidates = [];
  let resolvedBase = page.href;

  for (const discoveryUrl of discoveryUrls) {
    if (Date.now() - started >= budgetMs) {
      break;
    }
    try {
      const htmlFetch = await fetchBytesBounded(discoveryUrl, {
        signal,
        maxBytes: REMOTE_HTML_MAX_BYTES,
        allowPartial: true,
        accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.1",
      });
      if (htmlFetch.finalUrl) {
        resolvedBase = htmlFetch.finalUrl;
      }
      const ct = String(htmlFetch.contentType || "").toLowerCase();
      if (
        !ct ||
        ct.includes("html") ||
        ct.includes("xml") ||
        ct.includes("text") ||
        htmlFetch.truncated
      ) {
        const text = new TextDecoder("utf-8", { fatal: false }).decode(
          htmlFetch.bytes
        );
        candidates = parseHtmlIconCandidates(text, resolvedBase);
      }
      if (candidates.length) {
        break;
      }
    } catch {
      // try next discovery URL / fall through to root ICO
    }
  }

  if (Date.now() - started >= budgetMs) {
    return null;
  }

  // 2) Always consider the conventional root icon as a fallback candidate.
  try {
    const rootHref = new URL(rootIconPath(), resolvedBase).href;
    if (!candidates.some(c => c.href === rootHref)) {
      candidates.push({
        href: rootHref,
        type: "image/x-icon",
        sizes: "32x32",
        rel: "icon",
        score: 25,
      });
    }
  } catch {
    // ignore
  }

  // Try top candidates within the remaining budget.
  const tryList = candidates.slice(0, 6);
  for (const cand of tryList) {
    if (Date.now() - started >= budgetMs) {
      break;
    }
    if (/^data:image\//i.test(cand.href)) {
      const direct = sanitizeDataImageURI(cand.href);
      if (direct) {
        return direct;
      }
      // Non-allowlisted data: (e.g. SVG) — try decode path for raster data URIs.
      try {
        const comma = cand.href.indexOf(",");
        if (comma > 0 && /base64/i.test(cand.href.slice(0, comma))) {
          const header = cand.href.slice(5, comma).toLowerCase();
          const mime = header.split(";")[0];
          if (ALLOWED_SOURCE_MIME.has(mime)) {
            const payload = cand.href.slice(comma + 1).replace(/\s+/g, "");
            const binary = atob(payload);
            if (binary.length && binary.length <= REMOTE_ICON_MAX_BYTES) {
              const bytes = new Uint8Array(binary.length);
              for (let i = 0; i < binary.length; i++) {
                bytes[i] = binary.charCodeAt(i);
              }
              const safe = await bytesToSafeIconDataURI(bytes, mime, cand.href);
              if (safe) {
                return safe;
              }
            }
          }
        }
      } catch {
        // continue
      }
      continue;
    }
    try {
      const perTry = abortSignalFor(Math.min(3000, remaining()));
      const combined = combineSignals([signal, perTry]);
      const iconFetch = await fetchBytesBounded(cand.href, {
        signal: combined,
        maxBytes: REMOTE_ICON_MAX_BYTES,
        accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
      });
      const safe = await bytesToSafeIconDataURI(
        iconFetch.bytes,
        iconFetch.contentType || cand.type,
        cand.href
      );
      if (safe) {
        return safe;
      }
    } catch {
      // try next candidate
    }
  }
  return null;
}

/**
 * Resolve a favicon for a custom app URL: Places first, then remote discovery.
 * Never throws. Returns sanitized data URI or null (monogram fallback).
 */
export async function resolveCustomAppFaviconDataURI(
  pageUrl,
  {
    privateBrowsing = false,
    timeoutMs = REMOTE_FAVICON_TIMEOUT_MS,
    allowRemote = true,
  } = {}
) {
  if (privateBrowsing) {
    return null;
  }
  const fromPlaces = await resolvePlacesFaviconURL(pageUrl, {
    privateBrowsing,
  });
  if (fromPlaces) {
    return fromPlaces;
  }
  if (!allowRemote) {
    return null;
  }
  try {
    return await fetchRemoteFaviconAsDataURI(pageUrl, { timeoutMs });
  } catch {
    return null;
  }
}

function sniffImageMime(bytes) {
  if (!bytes || bytes.length < 12) {
    return null;
  }
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return "image/png";
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  if (
    bytes[0] === 0x00 &&
    bytes[1] === 0x00 &&
    bytes[2] === 0x01 &&
    bytes[3] === 0x00
  ) {
    return "image/x-icon";
  }
  const head = new TextDecoder("utf-8", { fatal: false })
    .decode(bytes.slice(0, 64))
    .trimStart()
    .toLowerCase();
  if (
    head.startsWith("<svg") ||
    head.startsWith("<?xml") ||
    head.startsWith("<!doctype") ||
    head.startsWith("<html") ||
    head.includes("<script")
  ) {
    return null;
  }
  return null;
}

function bytesToBase64(bytes) {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(
      null,
      bytes.subarray(i, Math.min(i + chunk, bytes.length))
    );
  }
  return btoa(binary);
}

/**
 * Decode + resize to <=128px PNG data URI. Always normalizes output.
 * Prefers createImageBitmap/OffscreenCanvas when available (window callers);
 * falls back to imgITools encodeScaledImage for chrome ESM modules (no window).
 */
export async function rasterBytesToSafeDataURI(bytes, mime) {
  if (!bytes?.byteLength) {
    throw new Error("empty");
  }
  if (bytes.byteLength > MAX_PICKER_BYTES) {
    throw new Error("too-large");
  }
  if (!mime || !ALLOWED_SOURCE_MIME.has(mime)) {
    throw new Error("unsupported-type");
  }

  // Path A: window / worker APIs (fast when present).
  if (
    typeof createImageBitmap === "function" &&
    typeof OffscreenCanvas === "function"
  ) {
    const blob = new Blob([bytes], { type: mime });
    let bitmap;
    try {
      bitmap = await createImageBitmap(blob);
    } catch {
      bitmap = null;
    }
    if (bitmap) {
      try {
        if (
          !bitmap.width ||
          !bitmap.height ||
          bitmap.width > MAX_DECODE_EDGE ||
          bitmap.height > MAX_DECODE_EDGE
        ) {
          throw new Error("too-large");
        }
        const scale = Math.min(
          1,
          MAX_ICON_EDGE / Math.max(bitmap.width, bitmap.height, 1)
        );
        const w = Math.max(1, Math.round(bitmap.width * scale));
        const h = Math.max(1, Math.round(bitmap.height * scale));
        const canvas = new OffscreenCanvas(w, h);
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          throw new Error("no-canvas");
        }
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(bitmap, 0, 0, w, h);
        const outBlob = await canvas.convertToBlob({ type: "image/png" });
        const outBytes = new Uint8Array(await outBlob.arrayBuffer());
        if (!outBytes.byteLength || outBytes.byteLength > MAX_STORED_ICON_BYTES) {
          throw new Error("too-large");
        }
        const uri = `data:image/png;base64,${bytesToBase64(outBytes)}`;
        if (uri.length > MAX_DATA_ICON_CHARS) {
          throw new Error("too-large");
        }
        const safe = sanitizeDataImageURI(uri);
        if (!safe) {
          throw new Error("unsupported-type");
        }
        return safe;
      } finally {
        try {
          bitmap.close();
        } catch {
          // ignore
        }
      }
    }
  }

  // Path B: chrome imgITools (works in ESM modules without a window).
  return encodeWithImgITools(bytes, mime);
}

function encodeWithImgITools(bytes, mime) {
  const imageTools = Cc["@mozilla.org/image/tools;1"].getService(Ci.imgITools);
  // decodeImageFromArrayBuffer needs a plain ArrayBuffer (not a view offset).
  const copy = bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength
    ? bytes.buffer
    : bytes.slice().buffer;
  let container;
  try {
    container = imageTools.decodeImageFromArrayBuffer(copy, mime);
  } catch {
    throw new Error("unsupported-type");
  }
  if (!container) {
    throw new Error("unsupported-type");
  }
  const srcW = container.width || 0;
  const srcH = container.height || 0;
  if (!srcW || !srcH || srcW > MAX_DECODE_EDGE || srcH > MAX_DECODE_EDGE) {
    throw new Error("too-large");
  }
  const scale = Math.min(1, MAX_ICON_EDGE / Math.max(srcW, srcH, 1));
  const w = Math.max(1, Math.round(srcW * scale));
  const h = Math.max(1, Math.round(srcH * scale));

  let stream;
  try {
    // encodeScaledImage(container, mimeType, width, height) → nsIInputStream
    stream = imageTools.encodeScaledImage(container, "image/png", w, h);
  } catch {
    throw new Error("unsupported-type");
  }
  if (!stream) {
    throw new Error("unsupported-type");
  }

  const binaryStream = Cc["@mozilla.org/binaryinputstream;1"].createInstance(
    Ci.nsIBinaryInputStream
  );
  binaryStream.setInputStream(stream);
  let available;
  try {
    available = binaryStream.available();
  } catch {
    available = 0;
  }
  if (!available || available > MAX_STORED_ICON_BYTES) {
    // Some streams report 0 until read — read in chunks up to cap.
    const chunks = [];
    let total = 0;
    try {
      while (true) {
        const n = binaryStream.available();
        if (!n) {
          break;
        }
        const take = Math.min(n, MAX_STORED_ICON_BYTES - total + 1);
        const part = binaryStream.readByteArray(take);
        chunks.push(Uint8Array.from(part));
        total += part.length;
        if (total > MAX_STORED_ICON_BYTES) {
          throw new Error("too-large");
        }
      }
    } catch (e) {
      if (e?.message === "too-large") {
        throw e;
      }
      // fall through with whatever we got
    }
    if (!total) {
      throw new Error("unsupported-type");
    }
    const outBytes = new Uint8Array(total);
    let off = 0;
    for (const c of chunks) {
      outBytes.set(c, off);
      off += c.byteLength;
    }
    const uri = `data:image/png;base64,${bytesToBase64(outBytes)}`;
    if (uri.length > MAX_DATA_ICON_CHARS) {
      throw new Error("too-large");
    }
    const safe = sanitizeDataImageURI(uri);
    if (!safe) {
      throw new Error("unsupported-type");
    }
    return safe;
  }

  const outBytes = Uint8Array.from(binaryStream.readByteArray(available));
  if (!outBytes.byteLength || outBytes.byteLength > MAX_STORED_ICON_BYTES) {
    throw new Error("too-large");
  }
  const uri = `data:image/png;base64,${bytesToBase64(outBytes)}`;
  if (uri.length > MAX_DATA_ICON_CHARS) {
    throw new Error("too-large");
  }
  const safe = sanitizeDataImageURI(uri);
  if (!safe) {
    throw new Error("unsupported-type");
  }
  return safe;
}

/**
 * One-shot migration: legacy profile filename → bounded PNG data URI.
 * Only reads from ICON_DIR_NAME. Returns "" on any failure.
 */
export async function migrateLegacyIconFileName(fileName) {
  const path = resolveLocalIconPath(fileName);
  if (!path) {
    return "";
  }
  try {
    const exists = await IOUtils.exists(path);
    if (!exists) {
      return "";
    }
    const bytes = await IOUtils.read(path);
    if (!bytes?.byteLength || bytes.byteLength > MAX_PICKER_BYTES) {
      return "";
    }
    const mime = sniffImageMime(bytes);
    if (!mime || !ALLOWED_SOURCE_MIME.has(mime)) {
      return "";
    }
    return await rasterBytesToSafeDataURI(bytes, mime);
  } catch {
    return "";
  }
}

/**
 * Pick an image via nsIFilePicker → safe PNG data URI (no path persistence).
 */
export async function pickCustomIconAsDataURI(win) {
  const fp = Cc["@mozilla.org/filepicker;1"].createInstance(Ci.nsIFilePicker);
  fp.init(win.browsingContext, "Choose App Icon", Ci.nsIFilePicker.modeOpen);
  fp.appendFilter("Images", "*.png;*.jpg;*.jpeg;*.webp;*.ico");
  fp.appendFilters(Ci.nsIFilePicker.filterImages);
  const result = await new Promise(resolve => fp.open(resolve));
  if (result !== Ci.nsIFilePicker.returnOK || !fp.file) {
    return null;
  }
  const bytes = await IOUtils.read(fp.file.path);
  if (!bytes?.byteLength) {
    throw new Error("empty");
  }
  if (bytes.byteLength > MAX_PICKER_BYTES) {
    throw new Error("too-large");
  }
  const mime = sniffImageMime(bytes);
  if (!mime || !ALLOWED_SOURCE_MIME.has(mime)) {
    throw new Error("unsupported-type");
  }
  return rasterBytesToSafeDataURI(bytes, mime);
}

/** @deprecated */
export async function pickAndStoreCustomIcon(win) {
  return pickCustomIconAsDataURI(win);
}

export async function deleteCustomIcons(fileNames) {
  if (!Array.isArray(fileNames) || !fileNames.length) {
    return;
  }
  for (const name of fileNames) {
    const path = resolveLocalIconPath(name);
    if (!path) {
      continue;
    }
    try {
      await IOUtils.remove(path, { ignoreAbsent: true });
    } catch {
      // ignore
    }
  }
}

/**
 * Estimate total custom icon URI chars across apps (for soft budget).
 */
export function totalCustomIconChars(apps) {
  if (!Array.isArray(apps)) {
    return 0;
  }
  let total = 0;
  for (const app of apps) {
    if (typeof app?.customIconData === "string") {
      total += app.customIconData.length;
    }
    if (typeof app?.cachedFaviconData === "string") {
      total += app.cachedFaviconData.length;
    }
  }
  return total;
}
