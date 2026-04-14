/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const { PlacesUtils } = ChromeUtils.importESModule(
  "resource://gre/modules/PlacesUtils.sys.mjs"
);

const LOG = (...args) => console.log("[ZenSpaceOverview]", ...args);
const LOG_ERR = (...args) => console.error("[ZenSpaceOverview]", ...args);

const TAB_CAP = 15;
const ALLOWED_PROTOCOLS = new Set(["http:", "https:", "about:", "chrome:"]);
const FAVICON_PROTOCOLS = new Set([
  "http:",
  "https:",
  "chrome:",
  "moz-icon:",
  "data:",
]);

let chromeWin = null;
let _draggedTab = null;
let _dragSourceWsId = null;

// ---------------------------------------------------------------------------
// Filter helpers (module-scope so buildGrid can re-apply after a rebuild)
// ---------------------------------------------------------------------------

function _showEl(el) { el.style.display = ""; }
function _hideEl(el) { el.style.display = "none"; }

// Recursively filter the tree, preserving group/folder structure.
// A group is kept only when it has at least one matching descendant tab;
// its children list is itself filtered the same way.
function filterTreeNodes(nodes, q) {
  const result = [];
  for (const node of nodes) {
    if (node.type === "tab") {
      const title = (node.tab.label ?? "").toLowerCase();
      const url =
        (node.tab.linkedBrowser?.currentURI?.spec ?? "").toLowerCase();
      if (title.includes(q) || url.includes(q)) result.push(node);
    } else if (node.type === "group") {
      const filteredChildren = filterTreeNodes(node.children, q);
      if (filteredChildren.length) {
        // Spread so the original node object is not mutated.
        result.push({ ...node, children: filteredChildren, collapsed: false });
      }
    }
  }
  return result;
}

// Render a (possibly filtered) tree with no TAB_CAP — used during search so
// every matching tab is shown regardless of how many there are.
function renderFilteredNodes(nodes, list, workspaceId, depth = 0) {
  for (const node of nodes) {
    if (node.type === "tab") {
      list.appendChild(buildTabRow(node.tab, workspaceId));
    } else if (node.type === "group") {
      list.appendChild(buildGroupNode(node, workspaceId, depth));
    }
  }
}

function applyFilter(q) {
  for (const card of document.querySelectorAll(
    ".space-card:not(.new-space-card)"
  )) {
    const body = card.querySelector(".card-body");
    if (!body) continue;

    if (!q) {
      // Restore the original rendered list (with tree structure and TAB_CAP).
      const currentList = body.querySelector(".tab-list");
      if (card._zenOriginalTabList && currentList !== card._zenOriginalTabList) {
        currentList.replaceWith(card._zenOriginalTabList);
      }
      // Release the height lock so the card can breathe freely again.
      card.style.minHeight = "";
      card._zenHeightLocked = false;
      continue;
    }

    // Lock the card height before touching the DOM so the tile never collapses.
    if (!card._zenHeightLocked) {
      card.style.minHeight = card.offsetHeight + "px";
      card._zenHeightLocked = true;
    }

    // Build a filtered tree preserving group/folder hierarchy.
    const workspaceId = card.dataset.workspaceId;
    const filteredNodes = filterTreeNodes(card._zenTreeNodes ?? [], q);
    const newList = makeEl("ul", { class: "tab-list" });
    if (filteredNodes.length) {
      renderFilteredNodes(filteredNodes, newList, workspaceId);
    } else {
      newList.appendChild(buildEmptyRow());
    }

    // Swap in the filtered list.
    const currentList = body.querySelector(".tab-list");
    if (currentList) {
      currentList.replaceWith(newList);
    } else {
      body.prepend(newList);
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getChromeWindow() {
  try {
    return window.browsingContext?.topChromeWindow ?? null;
  } catch {
    return null;
  }
}

function sanitizeURL(url) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return ALLOWED_PROTOCOLS.has(parsed.protocol) ? url : null;
  } catch {
    return null;
  }
}

function sanitizeFaviconURL(url) {
  if (!url) return null;
  try {
    return FAVICON_PROTOCOLS.has(new URL(url).protocol) ? url : null;
  } catch {
    return null;
  }
}

function makeEl(tag, attrs = {}) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    el.setAttribute(k, v);
  }
  return el;
}

// ---------------------------------------------------------------------------
// Favicon
// ---------------------------------------------------------------------------

function buildFavicon(tab) {
  const img = makeEl("img", { class: "tab-favicon", alt: "", loading: "lazy" });

  // Primary: tab.image (already sanitized browser favicon)
  const src = sanitizeFaviconURL(tab.image);
  if (src) {
    img.src = src;
    img.addEventListener("error", () => tryFaviconFallback(img, tab));
    return img;
  }

  // Secondary: gBrowser.getIcon()
  tryFaviconFallback(img, tab);
  return img;
}

function tryFaviconFallback(img, tab) {
  try {
    const gBrowser = chromeWin?.gBrowser;
    const iconUrl = gBrowser?.getIcon?.(tab);
    if (iconUrl && sanitizeFaviconURL(iconUrl)) {
      img.src = iconUrl;
      img.addEventListener("error", () => useDefaultFavicon(img), {
        once: true,
      });
      return;
    }
  } catch {
    // fall through
  }
  useDefaultFavicon(img);
}

function useDefaultFavicon(img) {
  img.src = "chrome://global/skin/icons/defaultFavicon.svg";
}

// ---------------------------------------------------------------------------
// Tree builder — walks workspace containers preserving group/folder hierarchy
// ---------------------------------------------------------------------------

function buildWorkspaceTree(workspace) {
  const { gZenWorkspaces, gBrowser } = chromeWin;
  const wsElement = gZenWorkspaces.workspaceElement?.(workspace.uuid);
  if (!wsElement) {
    const allTabs = Array.from(gZenWorkspaces.allStoredTabs ?? []);
    return allTabs
      .filter(t => t.getAttribute("zen-workspace-id") === workspace.uuid)
      .map(t => ({ type: "tab", tab: t }));
  }

  const nodes = [];
  const containers = [wsElement.pinnedTabsContainer, wsElement.tabsContainer];
  for (const container of containers) {
    if (!container || container.hasAttribute("cloned")) continue;
    walkContainer(container, nodes, gBrowser);
  }
  return nodes;
}

function walkContainer(container, nodes, gBrowser) {
  for (const child of container.children) {
    if (gBrowser.isTab(child)) {
      nodes.push({ type: "tab", tab: child });
      const glance = child.querySelector(".tabbrowser-tab[glance-id]");
      if (glance) {
        nodes.push({ type: "tab", tab: glance });
      }
    } else if (gBrowser.isTabGroup(child)) {
      const children = [];
      const groupContainer = child.groupContainer ?? child;
      walkContainer(groupContainer, children, gBrowser);
      nodes.push({
        type: "group",
        label: child.label || "",
        color: child.color || null,
        collapsed: child.collapsed ?? false,
        group: child,
        children,
      });
    }
  }
}

function countTreeTabs(nodes) {
  let count = 0;
  for (const node of nodes) {
    if (node.type === "tab") count++;
    else if (node.type === "group") count += countTreeTabs(node.children);
  }
  return count;
}

// ---------------------------------------------------------------------------
// Shared tab removal helper
// ---------------------------------------------------------------------------

function removeTabFromCard(tab, card, workspaceId) {
  chromeWin.gBrowser.removeTab(tab, { animate: true });

  if (card && workspaceId) {
    const workspace = chromeWin.gZenWorkspaces.getWorkspaceFromId(workspaceId);
    if (workspace) {
      const treeNodes = buildWorkspaceTree(workspace);
      chromeWin.ZenWorkspaceBookmarksStorage.getBookmarkGuidsByWorkspace()
        .then(byWorkspace => {
          card.replaceWith(buildCard(workspace, treeNodes, byWorkspace));
        })
        .catch(() => {
          card.replaceWith(buildCard(workspace, treeNodes, {}));
        });
    }
  }
}

// ---------------------------------------------------------------------------
// Tab rows
// ---------------------------------------------------------------------------

function buildTabRow(tab, workspaceId) {
  const row = makeEl("li", {
    class: "tab-row",
    role: "button",
    tabindex: "0",
  });
  row.dataset.workspaceId = workspaceId;
  row._zenTab = tab;

  const isLoading = tab.getAttribute("busy") === "true" || tab.hasAttribute("busy");

  if (chromeWin.gBrowser.selectedTab === tab) {
    row.classList.add("is-active");
  }
  if (isLoading) {
    row.classList.add("is-loading");
  }

  // Favicon wrapper with optional loading spinner
  const faviconWrapper = makeEl("span", { class: "tab-favicon-wrapper" });
  const favicon = buildFavicon(tab);
  faviconWrapper.appendChild(favicon);

  if (isLoading) {
    const spinner = makeEl("span", { class: "tab-loading-spinner" });
    faviconWrapper.appendChild(spinner);
  }

  const title = makeEl("span", { class: "tab-title" });
  title.textContent = tab.label || "(Untitled)";

  // Close button (STG pattern — visible on hover)
  const closeBtn = makeEl("button", { class: "tab-close", type: "button" });
  closeBtn.setAttribute("title", "");
  document.l10n.setAttributes(closeBtn, "zen-space-overview-close-tab");
  closeBtn.addEventListener("click", e => {
    e.stopPropagation();
    if (tab.closing) return;
    const card = row.closest(".space-card");
    const wsId = card?.dataset.workspaceId ?? workspaceId;
    removeTabFromCard(tab, card, wsId);
  });

  row.appendChild(faviconWrapper);
  row.appendChild(title);
  row.appendChild(closeBtn);

  if (!tab.hasAttribute("zen-essential")) {
    row.setAttribute("draggable", "true");
    row.addEventListener("dragstart", e => {
      _draggedTab = tab;
      _dragSourceWsId = workspaceId;
      e.dataTransfer.setData("application/x-zen-tab-id", "1");
      e.dataTransfer.effectAllowed = "move";
      row.classList.add("is-dragging");
    });
    row.addEventListener("dragend", () => {
      row.classList.remove("is-dragging");
      _draggedTab = null;
      _dragSourceWsId = null;
    });
  }

  return row;
}

function buildGroupNode(groupNode, workspaceId, depth) {
  const wrapper = makeEl("li", { class: "tree-group" });

  const header = makeEl("div", {
    class: "tree-group-header",
    role: "button",
    tabindex: "0",
  });

  const chevron = makeEl("span", { class: "tree-chevron" });
  chevron.textContent = "\u25B6";

  const folderIcon = makeEl("span", { class: "tree-folder-icon" });

  const label = makeEl("span", { class: "tree-group-label" });
  label.textContent = groupNode.label || "Group";

  const count = makeEl("span", { class: "tree-group-count" });
  const childTabCount = countTreeTabs(groupNode.children);
  count.textContent = String(childTabCount);

  if (groupNode.color) {
    header.style.setProperty("--group-color", groupNode.color);
    header.classList.add("has-group-color");
  }

  header.appendChild(chevron);
  header.appendChild(folderIcon);
  header.appendChild(label);
  header.appendChild(count);

  const childList = makeEl("ul", { class: "tree-children" });
  renderTreeNodes(groupNode.children, childList, workspaceId, depth + 1);

  wrapper.classList.add("tree-expanded");
  header.addEventListener("click", e => {
    e.stopPropagation();
    wrapper.classList.toggle("tree-expanded");
  });
  header.addEventListener("keydown", e => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      e.stopPropagation();
      wrapper.classList.toggle("tree-expanded");
    }
  });

  wrapper.appendChild(header);
  wrapper.appendChild(childList);
  return wrapper;
}

function renderTreeNodes(nodes, list, workspaceId, depth) {
  let tabsRendered = 0;
  const isRoot = depth === 0;
  const maxTabs = isRoot ? TAB_CAP : Infinity;

  for (const node of nodes) {
    if (node.type === "tab") {
      if (tabsRendered >= maxTabs) continue;
      list.appendChild(buildTabRow(node.tab, workspaceId));
      tabsRendered++;
    } else if (node.type === "group") {
      list.appendChild(buildGroupNode(node, workspaceId, depth));
    }
  }

  if (isRoot) {
    const totalTabs = nodes.filter(n => n.type === "tab").length;
    const remaining = totalTabs - tabsRendered;
    if (remaining > 0) {
      list.appendChild(buildMoreRow(remaining));
    }
  }
}

function buildMoreRow(remaining) {
  const row = makeEl("li", { class: "tab-row tab-more" });
  document.l10n.setAttributes(row, "zen-space-overview-more-tabs", {
    count: remaining,
  });
  return row;
}

function buildEmptyRow() {
  const row = makeEl("li", { class: "tab-empty" });
  document.l10n.setAttributes(row, "zen-space-overview-empty");
  return row;
}

// ---------------------------------------------------------------------------
// Bookmarks (async)
// ---------------------------------------------------------------------------

async function buildBookmarkSection(workspace, byWorkspace) {
  const section = makeEl("details", { class: "bookmark-section" });
  const summary = makeEl("summary", { class: "bookmark-heading" });
  document.l10n.setAttributes(summary, "zen-space-overview-bookmarks");
  section.appendChild(summary);

  try {
    const guids = byWorkspace[workspace.uuid] ?? [];

    if (!guids.length) {
      section.hidden = true;
      return section;
    }

    const items = await Promise.all(
      guids.map(guid =>
        PlacesUtils.bookmarks.fetch(guid).catch(() => null)
      )
    );

    const list = makeEl("ul", { class: "bookmark-list" });
    let added = 0;

    for (const item of items) {
      if (!item) continue;
      const url = item.url?.href ?? "";
      const safeURL = sanitizeURL(url);

      const li = makeEl("li", { class: "bookmark-item" });
      const a = makeEl("a", { class: "bookmark-link" });
      if (safeURL) {
        a.setAttribute("href", safeURL);
      }
      a.textContent = item.title || url || "(Bookmark)";

      a.addEventListener("click", e => {
        e.preventDefault();
        if (!safeURL) return;
        chromeWin.gZenWorkspaces
          .changeWorkspaceWithID(workspace.uuid)
          .then(() => {
            chromeWin.gBrowser.addTrustedTab(safeURL, {
              triggeringPrincipal:
                Services.scriptSecurityManager.getSystemPrincipal(),
            });
          })
          .catch(err => LOG_ERR("Bookmark navigation error:", err));
      });

      li.appendChild(a);
      list.appendChild(li);
      added++;
    }

    if (!added) {
      section.hidden = true;
      return section;
    }

    section.appendChild(list);
  } catch (err) {
    LOG_ERR("Bookmark section error:", err);
    section.hidden = true;
  }

  return section;
}

// ---------------------------------------------------------------------------
// Theme tinting
// ---------------------------------------------------------------------------

function applyThemeTint(card, workspace) {
  try {
    const picker = chromeWin.gZenThemePicker;
    if (!picker?.getGradientForWorkspace) return;
    const theme = picker.getGradientForWorkspace(workspace);
    const header = card.querySelector(".card-header");
    if (theme?.gradient && header) {
      header.style.setProperty("--space-theme-gradient", theme.gradient);
      header.classList.add("has-theme");
      if (theme.isDarkMode) {
        header.classList.add("theme-dark");
      }
    }
    if (theme?.primaryColor) {
      card.style.setProperty("--space-primary-color", theme.primaryColor);
      card.classList.add("has-theme");
    }
  } catch {
    // Cosmetic — ignore
  }
}

// ---------------------------------------------------------------------------
// Card builder
// ---------------------------------------------------------------------------

function buildCard(workspace, treeNodes, byWorkspace) {
  const { gZenWorkspaces } = chromeWin;

  const card = makeEl("section", {
    class: "space-card",
    "data-workspace-id": workspace.uuid,
  });

  if (gZenWorkspaces.activeWorkspace === workspace.uuid) {
    card.classList.add("is-active");
  }

  const totalTabs = countTreeTabs(treeNodes);

  // ---- Header (STG-style: icon | name-input | count | actions) ----
  const header = makeEl("div", { class: "card-header" });
  header.dataset.workspaceId = workspace.uuid;

  const icon = makeEl("span", { class: "space-icon" });
  const rawIcon = gZenWorkspaces.getWorkspaceIcon(workspace);
  // getWorkspaceIcon returns either a plain emoji string or a chrome:// URL
  // pointing to an SVG asset. Render URLs as <img> elements; anything else
  // is an emoji and can be set directly as text.
  if (rawIcon && (rawIcon.startsWith("chrome://") || rawIcon.startsWith("resource://"))) {
    const iconImg = makeEl("img", {
      src: rawIcon,
      alt: workspace.name,
      class: "space-icon-img",
    });
    icon.appendChild(iconImg);
  } else {
    icon.textContent = rawIcon;
  }

  // Inline-editable name input (mirrors STG group-title input)
  const nameInput = makeEl("input", {
    class: "space-name",
    type: "text",
    maxlength: "256",
  });
  nameInput.value = workspace.name;
  document.l10n.setAttributes(nameInput, "zen-space-overview-rename-placeholder");

  // Prevent drags while editing
  nameInput.addEventListener("focus", () => {
    card.removeAttribute("draggable");
  });

  // Save on blur
  nameInput.addEventListener("blur", () => {
    const newName = nameInput.value.trim();
    if (newName && newName !== workspace.name) {
      const updated = Object.assign({}, workspace, { name: newName });
      try {
        gZenWorkspaces.saveWorkspace(updated);
        workspace.name = newName;
      } catch (err) {
        LOG_ERR("Failed to rename workspace:", err);
        nameInput.value = workspace.name;
      }
    } else if (!newName) {
      nameInput.value = workspace.name;
    }
  });

  // Save on Enter, blur on Escape
  nameInput.addEventListener("keydown", e => {
    if (e.key === "Enter") {
      e.preventDefault();
      nameInput.blur();
    } else if (e.key === "Escape") {
      e.preventDefault();
      nameInput.value = workspace.name;
      nameInput.blur();
    }
    e.stopPropagation();
  });

  // Click on name field should not switch workspace
  nameInput.addEventListener("click", e => e.stopPropagation());

  const count = makeEl("span", { class: "space-count" });
  count.textContent = String(totalTabs);

  // Action icons: delete
  const actions = makeEl("div", { class: "card-actions" });

  const deleteBtn = makeEl("button", { class: "card-action-btn card-delete-btn", type: "button" });
  deleteBtn.textContent = "✕";
  document.l10n.setAttributes(deleteBtn, "zen-space-overview-delete-space");
  deleteBtn.addEventListener("click", async e => {
    e.stopPropagation();
    const workspaces = gZenWorkspaces.getWorkspaces();
    if (workspaces.length <= 1) return; // prevent deleting last space
    try {
      const [title, body] = await document.l10n.formatValues([
        { id: "zen-workspaces-delete-workspace-title" },
        {
          id: "zen-workspaces-delete-workspace-body",
          args: { name: workspace.name },
        },
      ]);
      if (Services.prompt.confirm(null, title, body)) {
        await gZenWorkspaces.removeWorkspace(workspace.uuid);
        buildGrid();
      }
    } catch (err) {
      LOG_ERR("Failed to delete workspace:", err);
    }
  });

  actions.appendChild(deleteBtn);

  // Header click (not on input or actions) switches space
  header.addEventListener("click", e => {
    if (
      e.target === nameInput ||
      e.target === deleteBtn ||
      actions.contains(e.target)
    ) {
      return;
    }
    const wsId = header.dataset.workspaceId;
    if (wsId) {
      Promise.resolve(
        gZenWorkspaces.changeWorkspaceWithID(wsId)
      ).catch(err => LOG_ERR("Space switch error:", err));
    }
  });
  header.setAttribute("role", "button");
  header.setAttribute("tabindex", "0");
  header.addEventListener("keydown", e => {
    if (e.key === "Enter" || e.key === " ") {
      if (document.activeElement === nameInput) return;
      const wsId = header.dataset.workspaceId;
      if (wsId) {
        Promise.resolve(
          gZenWorkspaces.changeWorkspaceWithID(wsId)
        ).catch(err => LOG_ERR("Space switch error:", err));
      }
    }
  });

  header.appendChild(icon);
  header.appendChild(nameInput);
  header.appendChild(count);
  header.appendChild(actions);
  card.appendChild(header);

  // ---- Body — tree view ----
  const body = makeEl("div", { class: "card-body" });
  const list = makeEl("ul", { class: "tab-list" });

  if (!treeNodes.length) {
    list.appendChild(buildEmptyRow());
  } else {
    renderTreeNodes(treeNodes, list, workspace.uuid, 0);
  }

  body.appendChild(list);
  card.appendChild(body);

  // Store refs so applyFilter can re-render dynamically without a full rebuild.
  card._zenTreeNodes = treeNodes;
  card._zenOriginalTabList = list;

  // Bookmark placeholder (filled async)
  const placeholder = makeEl("div", { class: "bookmark-placeholder" });
  card.appendChild(placeholder);
  buildBookmarkSection(workspace, byWorkspace).then(section =>
    placeholder.replaceWith(section)
  );

  // Theme tinting
  applyThemeTint(card, workspace);

  // Drop target — accept tab drags from other space cards
  let _dragCounter = 0;
  card.addEventListener("dragover", e => {
    if (!_draggedTab || card.dataset.workspaceId === _dragSourceWsId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  });
  card.addEventListener("dragenter", () => {
    if (!_draggedTab || card.dataset.workspaceId === _dragSourceWsId) return;
    if (++_dragCounter === 1) card.classList.add("drag-over");
  });
  card.addEventListener("dragleave", () => {
    if (--_dragCounter <= 0) {
      _dragCounter = 0;
      card.classList.remove("drag-over");
    }
  });
  card.addEventListener("drop", e => {
    e.preventDefault();
    card.classList.remove("drag-over");
    _dragCounter = 0;
    const targetWsId = card.dataset.workspaceId;
    if (!_draggedTab || targetWsId === _dragSourceWsId) return;
    chromeWin.gZenWorkspaces.moveTabToWorkspace(_draggedTab, targetWsId);
    _draggedTab = null;
    _dragSourceWsId = null;
    buildGrid();
  });

  return card;
}

function buildNewSpaceCard() {
  const card = makeEl("section", {
    class: "space-card new-space-card",
    role: "button",
    tabindex: "0",
  });

  const plusIcon = makeEl("span", { class: "new-space-plus" });
  plusIcon.textContent = "+";

  const label = makeEl("span", { class: "new-space-label" });
  label.textContent = "New Space";
  document.l10n.setAttributes(label, "zen-space-overview-new-space");

  card.appendChild(plusIcon);
  card.appendChild(label);

  const activate = () => chromeWin.gZenWorkspaces.openWorkspaceCreation();
  card.addEventListener("click", activate);
  card.addEventListener("keydown", e => {
    if (e.key === "Enter" || e.key === " ") activate();
  });

  return card;
}

// ---------------------------------------------------------------------------
// Grid builder
// ---------------------------------------------------------------------------

async function buildGrid() {
  LOG("Building grid");
  const grid = document.getElementById("grid");
  grid.textContent = "";

  if (!chromeWin) {
    const err = makeEl("div", { class: "error-state" });
    document.l10n.setAttributes(err, "zen-space-overview-error");
    grid.appendChild(err);
    return;
  }

  const { gZenWorkspaces, ZenWorkspaceBookmarksStorage } = chromeWin;
  const workspaces = gZenWorkspaces.getWorkspaces();

  let byWorkspace = {};
  try {
    byWorkspace =
      await ZenWorkspaceBookmarksStorage.getBookmarkGuidsByWorkspace();
  } catch (err) {
    LOG_ERR("Failed to fetch bookmark guids:", err);
  }

  for (const workspace of workspaces) {
    const treeNodes = buildWorkspaceTree(workspace);
    grid.appendChild(buildCard(workspace, treeNodes, byWorkspace));
  }

  grid.appendChild(buildNewSpaceCard());
  LOG("Grid built:", workspaces.length, "space(s)");

  // Re-apply any active search so the filter survives a grid rebuild
  // (e.g. when the tab regains focus and visibilitychange triggers a refresh).
  const activeQuery = document.getElementById("search")?.value.trim().toLowerCase() ?? "";
  if (activeQuery) applyFilter(activeQuery);
}

// ---------------------------------------------------------------------------
// Event listeners
// ---------------------------------------------------------------------------

function attachListeners() {
  const grid = document.getElementById("grid");

  // Unified click handler for the grid (tab rows only — headers handled per-card)
  grid.addEventListener("click", e => {
    // Tab row click — switch space then select that tab
    const row = e.target.closest(
      ".tab-row:not(.tab-more):not(.tab-empty):not(.new-space-card)"
    );
    if (row?._zenTab && !row._zenTab.closing) {
      // Don't activate if clicking the close button
      if (e.target.closest(".tab-close")) return;
      const wsId = row.dataset.workspaceId;
      if (wsId) {
        Promise.resolve(
          chromeWin.gZenWorkspaces.changeWorkspaceWithID(wsId)
        )
          .then(() => {
            chromeWin.gBrowser.selectedTab = row._zenTab;
          })
          .catch(err => LOG_ERR("Tab switch error:", err));
      }
      return;
    }
  });

  // Middle-click on a tab row → close that tab
  grid.addEventListener("auxclick", e => {
    if (e.button !== 1) return;
    const row = e.target.closest(
      ".tab-row:not(.tab-more):not(.tab-empty)"
    );
    if (!row?._zenTab || row._zenTab.closing) return;
    e.preventDefault();

    const card = row.closest(".space-card");
    const wsId = card?.dataset.workspaceId;
    removeTabFromCard(row._zenTab, card, wsId);
  });

  // Keyboard activation for tab rows
  grid.addEventListener("keydown", e => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const row = e.target.closest(
      ".tab-row:not(.tab-more):not(.tab-empty)"
    );
    if (row?._zenTab && !row._zenTab.closing) {
      row.click();
    }
  });

  const searchEl = document.getElementById("search");

  let _searchTimer = null;
  searchEl.addEventListener("input", e => {
    clearTimeout(_searchTimer);
    _searchTimer = setTimeout(
      () => applyFilter(e.target.value.trim().toLowerCase()),
      120
    );
  });

  // Inspired by the URL-bar workspace search shortcut approach: any printable
  // key typed while the search bar is not already focused auto-redirects there
  // so the user never needs to click the search input first.
  document.addEventListener("keydown", e => {
    // Let F3 and Escape always work regardless of focus.
    if (e.key === "Escape") {
      searchEl.value = "";
      applyFilter("");
      searchEl.blur();
      return;
    }
    if (e.key === "F3") {
      e.preventDefault();
      searchEl.focus();
      return;
    }

    // Skip modifier-only combos, function keys, and navigation keys.
    if (e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey) return;
    // Don't steal focus from the rename input inside a card.
    if (document.activeElement?.classList.contains("space-name")) return;
    // Already focused — let keystrokes flow naturally.
    if (document.activeElement === searchEl) return;

    // Focus the search bar; the browser will insert the pressed character.
    searchEl.focus();
  });

  // Refresh button
  document.getElementById("refresh-btn").addEventListener("click", () => {
    document.getElementById("search").value = "";
    buildGrid();
  });

  // Create space button (toolbar)
  const createBtn = document.getElementById("create-space-btn");
  if (createBtn) {
    createBtn.addEventListener("click", () => {
      chromeWin.gZenWorkspaces.openWorkspaceCreation();
    });
  }

  // Auto-refresh when tab regains focus
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      LOG("Tab regained focus — refreshing");
      buildGrid();
    }
  });
}

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

document.addEventListener("DOMContentLoaded", () => {
  LOG("Initializing");

  chromeWin = getChromeWindow();
  if (!chromeWin) {
    LOG_ERR("topChromeWindow unavailable");
  }

  attachListeners();
  buildGrid();
});
