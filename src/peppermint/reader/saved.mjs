/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * about:saved: lists the articles saved for offline reading, and opens,
 * searches and removes them.
 */

const {
  STORE_CHANGED_TOPIC,
  clearArticles,
  listArticles,
  removeArticle,
  totalBytes,
} = ChromeUtils.importESModule(
  "moz-src:///peppermint/reader/PeppermintReaderStore.sys.mjs"
);
const { PeppermintReader } = ChromeUtils.importESModule(
  "moz-src:///peppermint/reader/PeppermintReader.sys.mjs"
);

const CONFIRM_RESET_MS = 3000;
const ICON_PATH = "chrome://browser/skin/zen-icons/";

const list = document.getElementById("saved-list");
const search = document.getElementById("saved-search");
const clearButton = document.getElementById("saved-clear");
const emptyState = document.getElementById("saved-empty");
const noResults = document.getElementById("saved-no-results");
const errorNote = document.getElementById("saved-error");
const storage = document.getElementById("saved-storage");

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });

let articles = [];
let confirmTimer = null;

function hostOf(spec) {
  return URL.parse(spec)?.host.replace(/^www\./, "") ?? spec;
}

function formatSize(bytes) {
  const megabytes = bytes / (1024 * 1024);
  const [unit, value] =
    megabytes >= 1 ? ["megabyte", megabytes] : ["kilobyte", bytes / 1024];
  return new Intl.NumberFormat(undefined, {
    style: "unit",
    unit,
    unitDisplay: "short",
    maximumFractionDigits: 1,
  }).format(value);
}

function iconButton(className, icon, l10nId) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `saved-icon-button ${className}`;
  document.l10n.setAttributes(button, l10nId);
  const image = document.createElement("img");
  image.src = `${ICON_PATH}${icon}`;
  image.alt = "";
  button.append(image);
  return button;
}

function buildRow(record) {
  const item = document.createElement("li");
  item.className = "saved-item";
  item.dataset.id = record.id;

  const link = document.createElement("a");
  link.className = "saved-link";
  link.href = record.url;

  const title = document.createElement("span");
  title.className = "saved-item-title";
  title.textContent = record.title;
  link.append(title);

  const meta = document.createElement("span");
  meta.className = "saved-item-meta";
  const site = document.createElement("span");
  site.textContent = record.siteName || hostOf(record.url);
  meta.append(site);
  if (record.readingTimeMinsSlow) {
    const reading = document.createElement("span");
    document.l10n.setAttributes(reading, "peppermint-saved-reading-time", {
      minutes: record.readingTimeMinsSlow,
    });
    meta.append(reading);
  }
  const saved = document.createElement("span");
  document.l10n.setAttributes(saved, "peppermint-saved-saved-on", {
    date: dateFormat.format(record.savedAt),
  });
  meta.append(saved);
  link.append(meta);

  if (record.excerpt) {
    const excerpt = document.createElement("span");
    excerpt.className = "saved-item-excerpt";
    excerpt.textContent = record.excerpt;
    link.append(excerpt);
  }

  const actions = document.createElement("span");
  actions.className = "saved-item-actions";
  actions.append(
    iconButton("saved-open-tab", "tab.svg", "peppermint-saved-open-new-tab"),
    iconButton("saved-remove", "trash.svg", "peppermint-saved-remove")
  );

  item.append(link, actions);
  return item;
}

function matches(record, query) {
  return [record.title, record.siteName, record.excerpt, record.url]
    .join("\n")
    .toLowerCase()
    .includes(query);
}

function render() {
  const query = search.value.trim().toLowerCase();
  const visible = query
    ? articles.filter(record => matches(record, query))
    : articles;

  list.replaceChildren(...visible.map(buildRow));
  emptyState.hidden = !!articles.length;
  noResults.hidden = !articles.length || !!visible.length;
  search.hidden = !articles.length;
  clearButton.hidden = !articles.length;
}

async function load() {
  const [records, bytes] = await Promise.all([listArticles(), totalBytes()]);
  articles = records;
  render();
  if (records.length) {
    document.l10n.setAttributes(storage, "peppermint-saved-storage", {
      count: records.length,
      size: formatSize(bytes),
    });
  } else {
    storage.removeAttribute("data-l10n-id");
    storage.textContent = "";
  }
}

async function openArticle(id, where) {
  errorNote.hidden = true;
  const win = window.browsingContext.topChromeWindow;
  if (!(await PeppermintReader.openArticle(win, id, where))) {
    errorNote.hidden = false;
    await load();
  }
}

function resetClearButton() {
  clearTimeout(confirmTimer);
  confirmTimer = null;
  clearButton.classList.remove("confirming");
  document.l10n.setAttributes(clearButton, "peppermint-saved-clear-all");
}

list.addEventListener("click", event => {
  const item = event.target.closest(".saved-item");
  if (!item) {
    return;
  }
  const id = item.dataset.id;
  if (event.target.closest(".saved-remove")) {
    removeArticle(id);
  } else if (event.target.closest(".saved-open-tab")) {
    openArticle(id, "tab");
  } else if (event.target.closest(".saved-link")) {
    event.preventDefault();
    openArticle(id, event.ctrlKey || event.metaKey ? "tab" : "current");
  }
});

list.addEventListener("auxclick", event => {
  const item = event.target.closest(".saved-item");
  if (item && event.button === 1 && event.target.closest(".saved-link")) {
    event.preventDefault();
    openArticle(item.dataset.id, "tab");
  }
});

search.addEventListener("input", render);

clearButton.addEventListener("click", () => {
  if (!confirmTimer) {
    clearButton.classList.add("confirming");
    document.l10n.setAttributes(clearButton, "peppermint-saved-clear-confirm");
    confirmTimer = setTimeout(resetClearButton, CONFIRM_RESET_MS);
    return;
  }
  resetClearButton();
  clearArticles();
});

// Another window saving or removing an article changes this list too.
const observer = { observe: () => load() };
Services.obs.addObserver(observer, STORE_CHANGED_TOPIC);
window.addEventListener(
  "unload",
  () => Services.obs.removeObserver(observer, STORE_CHANGED_TOPIC),
  { once: true }
);

load();
