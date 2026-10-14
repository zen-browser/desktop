/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const PREF_MODE = "zen.homepage.mode";
const PREF_URL = "zen.homepage.url";
const PREF_ACTIVE_MS = "zen.homepage.daily-active-ms";
const PREF_ACTIVE_DAY = "zen.homepage.daily-active-day";

const CARD_PREFS = {
  "time-spent": "zen.homepage.cards.time-spent",
  "top-site": "zen.homepage.cards.top-site",
  "network-speed": "zen.homepage.cards.network-speed",
  downloads: "zen.homepage.cards.downloads",
  "visited-sites": "zen.homepage.cards.visited-sites",
  version: "zen.homepage.cards.version",
  clock: "zen.homepage.cards.clock",
};

const MODES = new Set(["builtin", "blank", "custom"]);

let lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  PlacesUtils: "resource://gre/modules/PlacesUtils.sys.mjs",
  Downloads: "resource://gre/modules/Downloads.sys.mjs",
});

const HISTORY_TTL_MS = 2 * 60 * 1000;

let trackingStarted = false;
let lastTick = 0;
let pendingMs = 0;
let historyCache = null;
let historyInflight = null;
let historyEpoch = 0;
let historyObserved = false;
let historyQueries = 0;

function todayKey() {
  const date = new Date();
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

function ensureToday() {
  const key = todayKey();
  const stored = Services.prefs.getStringPref(PREF_ACTIVE_DAY, "");
  if (stored === key) {
    return;
  }
  pendingMs = 0;
  lastTick = 0;
  Services.prefs.setStringPref(PREF_ACTIVE_DAY, key);
  Services.prefs.setIntPref(PREF_ACTIVE_MS, 0);
  if (anyWindowFocused()) {
    lastTick = Date.now();
  }
}

function flushActiveTime() {
  if (!pendingMs) {
    return;
  }
  ensureToday();
  const total = Services.prefs.getIntPref(PREF_ACTIVE_MS, 0) + pendingMs;
  Services.prefs.setIntPref(PREF_ACTIVE_MS, total);
  pendingMs = 0;
}

function pauseActiveTime() {
  if (!lastTick) {
    return;
  }
  const elapsed = Date.now() - lastTick;
  lastTick = 0;
  if (elapsed > 0 && elapsed < 12 * 60 * 60 * 1000) {
    pendingMs += elapsed;
  }
  flushActiveTime();
}

function resumeActiveTime() {
  if (!lastTick && anyWindowFocused()) {
    lastTick = Date.now();
  }
}

function anyWindowFocused() {
  for (const win of Services.wm.getEnumerator("navigator:browser")) {
    if (!win.closed && win.document.hasFocus()) {
      return true;
    }
  }
  return false;
}

/**
 * Count focused browser time for the current local day. Focus, blur, and
 * sleep notifications replace the old one-second poll.
 */
export function startActiveTimeTracking() {
  if (trackingStarted) {
    return;
  }
  trackingStarted = true;
  const onFocus = () => resumeActiveTime();
  const onBlur = () => {
    Services.tm.dispatchToMainThread(() => {
      if (!anyWindowFocused()) {
        pauseActiveTime();
      }
    });
  };
  const watch = win => {
    if (!win || win.closed || win.__zenActiveTimeWatch) {
      return;
    }
    win.__zenActiveTimeWatch = true;
    win.addEventListener("focus", onFocus);
    win.addEventListener("blur", onBlur);
  };
  for (const win of Services.wm.getEnumerator("navigator:browser")) {
    watch(win);
  }
  Services.obs.addObserver(subject => watch(subject), "browser-delayed-startup-finished");
  Services.obs.addObserver(() => pauseActiveTime(), "sleep_notification");
  Services.obs.addObserver(() => resumeActiveTime(), "wake_notification");
  Services.obs.addObserver(() => pauseActiveTime(), "quit-application");
  resumeActiveTime();
}

export function getTodayActiveMs() {
  ensureToday();
  const live = lastTick ? Math.max(0, Date.now() - lastTick) : 0;
  return Services.prefs.getIntPref(PREF_ACTIVE_MS, 0) + pendingMs + live;
}

export function formatDuration(ms) {
  const totalMinutes = Math.max(0, Math.floor(ms / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

function ordinal(day) {
  const mod100 = day % 100;
  if (mod100 >= 11 && mod100 <= 13) {
    return `${day}th`;
  }
  switch (day % 10) {
    case 1:
      return `${day}st`;
    case 2:
      return `${day}nd`;
    case 3:
      return `${day}rd`;
    default:
      return `${day}th`;
  }
}

export function formatToday(date = new Date()) {
  const month = date.toLocaleString(undefined, { month: "long" });
  return `${month} ${ordinal(date.getDate())}, ${date.getFullYear()}`;
}

export function formatClock(date = new Date()) {
  return date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function isValidHttpURL(raw) {
  if (!raw || typeof raw !== "string") {
    return false;
  }
  try {
    const url = new URL(raw.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function formatSpeed(bytesPerSec) {
  if (!bytesPerSec || bytesPerSec <= 0) {
    return "—";
  }
  const megabytes = bytesPerSec / (1024 * 1024);
  if (megabytes >= 0.1) {
    const rounded =
      megabytes >= 10 ? Math.round(megabytes) : Math.round(megabytes * 10) / 10;
    return `${rounded}MB/s`;
  }
  return `${Math.max(1, Math.round(bytesPerSec / 1024))}KB/s`;
}

async function getDisplayName() {
  try {
    const { UIState } = ChromeUtils.importESModule(
      "resource://services-sync/UIState.sys.mjs"
    );
    const displayName = UIState.get()?.displayName?.trim();
    if (displayName) {
      return displayName;
    }
  } catch {
    // Sync UI state is optional.
  }
  const shareName = Services.prefs
    .getStringPref("zen.share.display-name", "")
    .trim();
  if (shareName) {
    return shareName;
  }
  try {
    const envName = Services.env.get("USERNAME") || Services.env.get("USER");
    if (envName) {
      return envName;
    }
  } catch {
    // Environment lookup is best-effort.
  }
  try {
    return Cc["@mozilla.org/toolkit/profile-service;1"].getService(
      Ci.nsIToolkitProfileService
    ).currentProfile.name;
  } catch {
    return "there";
  }
}

async function queryTopSite() {
  const db = await lazy.PlacesUtils.promiseDBConnection();
  const rows = await db.executeCached(
    `SELECT url, title
     FROM moz_places
     WHERE hidden = 0
       AND visit_count > 0
       AND url NOT LIKE :about
       AND url NOT LIKE :chrome
       AND url NOT LIKE :resource
       AND url NOT LIKE :extension
       AND url NOT LIKE :blob
       AND url NOT LIKE :data
     ORDER BY frecency DESC
     LIMIT 1`,
    {
      about: "about:%",
      chrome: "chrome:%",
      resource: "resource:%",
      extension: "moz-extension:%",
      blob: "blob:%",
      data: "data:%",
    }
  );
  if (!rows.length) {
    return "—";
  }
  const url = rows[0].getResultByName("url");
  const title = rows[0].getResultByName("title");
  if (title && !title.includes("://") && title.length <= 22) {
    return title;
  }
  try {
    return new URL(url).hostname.replace(/^www\./, "") || title || "—";
  } catch {
    return title || "—";
  }
}

async function queryVisitedOrigins() {
  const db = await lazy.PlacesUtils.promiseDBConnection();
  const rows = await db.executeCached(
    `SELECT COUNT(DISTINCT rev_host) AS count
     FROM moz_places
     WHERE hidden = 0
       AND visit_count > 0
       AND rev_host <> '.'
       AND url NOT LIKE :about
       AND url NOT LIKE :chrome
       AND url NOT LIKE :extension`,
    {
      about: "about:%",
      chrome: "chrome:%",
      extension: "moz-extension:%",
    }
  );
  return String(rows[0]?.getResultByName("count") || 0);
}

function watchHistory() {
  if (historyObserved) {
    return;
  }
  try {
    lazy.PlacesUtils.observers.addListener(
      ["history-cleared", "page-removed"],
      () => {
        historyEpoch++;
        historyCache = null;
      }
    );
    historyObserved = true;
  } catch (error) {
    console.error("Zen homepage could not watch history", error);
  }
}

async function historyStats() {
  if (historyCache && Date.now() < historyCache.expires) {
    return historyCache;
  }
  if (historyInflight) {
    return historyInflight;
  }
  watchHistory();
  const epoch = historyEpoch;
  historyQueries++;
  historyInflight = Promise.all([queryTopSite(), queryVisitedOrigins()])
    .then(([topSite, visitedSites]) => {
      const result = {
        topSite,
        visitedSites,
        expires: Date.now() + HISTORY_TTL_MS,
      };
      if (epoch === historyEpoch) {
        historyCache = result;
      }
      return result;
    })
    .finally(() => {
      historyInflight = null;
    });
  return historyInflight;
}

/**
 * @returns {{ queries: number, cached: boolean }} How many history reads ran
 */
export function homepageHistoryCacheForTests() {
  return {
    queries: historyQueries,
    cached: !!historyCache && Date.now() < historyCache.expires,
  };
}

async function queryDownloads() {
  try {
    const list = await lazy.Downloads.getList(lazy.Downloads.ALL);
    const downloads = await list.getAll();
    const visible = downloads.filter(download => !download.source?.isPrivate);
    const finished = visible.filter(
      download => download.succeeded && !download.canceled
    );
    let speedSum = 0;
    let speedCount = 0;
    for (const download of visible) {
      if (download.speed > 0) {
        speedSum += download.speed;
        speedCount++;
      }
    }
    return {
      count: String(finished.length),
      speed: speedCount ? formatSpeed(speedSum / speedCount) : "—",
    };
  } catch (error) {
    console.error("Zen homepage download stats failed", error);
    return { count: "0", speed: "—" };
  }
}

export async function collectHomepageStats({ isPrivate = false } = {}) {
  const [name, downloads] = await Promise.all([
    getDisplayName(),
    queryDownloads(),
  ]);
  let topSite = "—";
  let visitedSites = "—";
  if (!isPrivate) {
    try {
      const history = await historyStats();
      topSite = history.topSite;
      visitedSites = history.visitedSites;
    } catch (error) {
      console.error("Zen homepage history stats failed", error);
    }
  }
  return {
    name,
    dateLabel: formatToday(),
    clockLabel: formatClock(),
    timeSpent: formatDuration(getTodayActiveMs()),
    topSite,
    networkSpeed: downloads.speed,
    downloads: downloads.count,
    visitedSites,
    version: `v${Services.appinfo.version}`,
  };
}

export const ZenHomepage = {
  getMode() {
    const mode = Services.prefs.getStringPref(PREF_MODE, "builtin");
    return MODES.has(mode) ? mode : "builtin";
  },

  getCustomURL() {
    const raw = Services.prefs.getStringPref(PREF_URL, "").trim();
    return isValidHttpURL(raw) ? raw : "";
  },

  shouldShowBuiltin() {
    return this.getMode() === "builtin";
  },

  /**
   * URL used when Zen cannot keep the empty tab and must open a fallback tab.
   * Built-in and blank stay on about:blank; custom uses the validated URL.
   */
  getEmptyTabFallbackURL() {
    if (this.getMode() === "custom") {
      const url = this.getCustomURL();
      if (url) {
        return url;
      }
    }
    return "about:blank";
  },

  isCardEnabled(cardId) {
    const pref = CARD_PREFS[cardId];
    if (!pref) {
      return false;
    }
    return Services.prefs.getBoolPref(pref, true);
  },

  cardPrefNames() {
    return Object.values(CARD_PREFS);
  },
};
