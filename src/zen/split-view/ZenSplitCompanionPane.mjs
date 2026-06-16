// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { nsZenDOMOperatedFeature } from "chrome://browser/content/zen-components/ZenCommonUtils.mjs";

const kPrefs = {
  enabled: "zen.splitCompanion.enabled",
  paneVisible: "zen.splitCompanion.pane.visible",
  rightWebVisible: "zen.splitCompanion.rightWeb.visible",
};

const kSplitActionFailedAttribute = "data-zen-split-action-failed";
const kSplitActionErrorAttribute = "data-zen-split-action-error";
const kRightWebVisibilityFailedAttribute =
  "data-zen-right-web-visibility-failed";
const kRightWebVisibilityErrorAttribute =
  "data-zen-right-web-visibility-error";
const kWorkspaceSwitchFailedAttribute = "data-zen-workspace-switch-failed";
const kWorkspaceSwitchErrorAttribute = "data-zen-workspace-switch-error";

export const ZEN_SPLIT_COMPANION_REFRESH_EVENTS = Object.freeze([
  "TabOpen",
  "TabClose",
  "TabSelect",
  "TabMove",
  "TabAttrModified",
  "TabPinned",
  "TabUnpinned",
  "DOMTitleChanged",
  "ZenTabIconChanged",
  "DOMAudioPlaybackStarted",
  "DOMAudioPlaybackStopped",
  "ZenWorkspacesUIUpdate",
  "ZenWorkspaceDataChanged",
]);

function defaultBrowser() {
  return typeof gBrowser == "undefined" ? null : gBrowser;
}

function defaultWorkspaceManager() {
  return typeof gZenWorkspaces == "undefined" ? null : gZenWorkspaces;
}

function readAttribute(item, name) {
  try {
    return item?.getAttribute?.(name) ?? "";
  } catch {
    return "";
  }
}

function hasAttribute(item, name) {
  try {
    return !!item?.hasAttribute?.(name);
  } catch {
    return false;
  }
}

function readProperty(item, name, fallback = undefined) {
  try {
    return item == null ? fallback : item[name];
  } catch {
    return fallback;
  }
}

function readNestedProperty(item, names, fallback = undefined) {
  let value = item;
  for (const name of names) {
    value = readProperty(value, name);
    if (value == null) {
      return fallback;
    }
  }
  return value;
}

function readBoolProperty(item, name) {
  return !!readProperty(item, name, false);
}

function readString(value) {
  return value == null ? "" : String(value);
}

function createCompanionElement(document, localName, className = "") {
  const element =
    typeof document.createXULElement == "function"
      ? document.createXULElement(localName)
      : document.createElement(localName);
  if (className) {
    element.classList.add(...className.split(" ").filter(Boolean));
  }
  return element;
}

function setLabelValue(label, value) {
  const text = readString(value);
  label.value = text;
  label.setAttribute("value", text);
}

function setDataAttribute(element, name, value) {
  const stringValue = readString(value);
  if (stringValue) {
    element.setAttribute(name, stringValue);
  }
}

function setStateAttribute(element, name, value) {
  element.toggleAttribute(name, !!value);
}

function clearSplitActionFailure(row) {
  row.removeAttribute(kSplitActionFailedAttribute);
  row.removeAttribute(kSplitActionErrorAttribute);
}

function markSplitActionFailure(row, reason) {
  row.setAttribute(kSplitActionFailedAttribute, "true");
  const error = readString(reason);
  if (error) {
    row.setAttribute(kSplitActionErrorAttribute, error);
  } else {
    row.removeAttribute(kSplitActionErrorAttribute);
  }
}

function clearRightWebVisibilityFailure(host) {
  host.removeAttribute(kRightWebVisibilityFailedAttribute);
  host.removeAttribute(kRightWebVisibilityErrorAttribute);
}

function markRightWebVisibilityFailure(host, reason) {
  host.setAttribute(kRightWebVisibilityFailedAttribute, "true");
  const error = readString(reason);
  if (error) {
    host.setAttribute(kRightWebVisibilityErrorAttribute, error);
  } else {
    host.removeAttribute(kRightWebVisibilityErrorAttribute);
  }
}

function clearWorkspaceSwitchFailure(row) {
  row.removeAttribute(kWorkspaceSwitchFailedAttribute);
  row.removeAttribute(kWorkspaceSwitchErrorAttribute);
}

function markWorkspaceSwitchFailure(row, reason) {
  row.setAttribute(kWorkspaceSwitchFailedAttribute, "true");
  const error = readString(reason);
  if (error) {
    row.setAttribute(kWorkspaceSwitchErrorAttribute, error);
  } else {
    row.removeAttribute(kWorkspaceSwitchErrorAttribute);
  }
}

function findCompanionWorkspaceRow(target, host) {
  for (let node = target; node && node !== host; node = node.parentNode) {
    if (node.classList?.contains("zen-split-companion-workspace-row")) {
      return node;
    }
  }
  return null;
}

function findCompanionWorkspaceRowById(workspaceId, host) {
  if (!workspaceId || !host) {
    return null;
  }

  for (const row of host.querySelectorAll(
    ".zen-split-companion-workspace-row"
  )) {
    if (readAttribute(row, "data-zen-workspace-id") === workspaceId) {
      return row;
    }
  }
  return null;
}

function findCompanionTabRow(target, host) {
  for (let node = target; node && node !== host; node = node.parentNode) {
    if (node.classList?.contains("zen-split-companion-tab-row")) {
      return node;
    }
  }
  return null;
}

function findLiveTabForCompanionRow(row, browser = defaultBrowser()) {
  const tabId = readAttribute(row, "data-zen-tab-id");
  if (!tabId) {
    return null;
  }

  const tabs = Array.from(readProperty(browser, "tabs", []) ?? []);
  return tabs.find(candidate => getStableTabId(candidate) === tabId) ?? null;
}

function defaultViewSplitter() {
  return typeof gZenViewSplitter == "undefined" ? null : gZenViewSplitter;
}

function normalizeWorkspace(workspace, activeWorkspaceId, index) {
  const id = readString(
    readProperty(workspace, "uuid") ?? readProperty(workspace, "id")
  );
  const containerTabId = readProperty(workspace, "containerTabId");
  return {
    id,
    name: readString(
      readProperty(workspace, "name") ?? readProperty(workspace, "label")
    ),
    active: !!id && id === activeWorkspaceId,
    icon: readString(readProperty(workspace, "icon")),
    containerTabId: typeof containerTabId == "number" ? containerTabId : null,
    position: index,
  };
}

function getWorkspaces(workspaceManager, activeWorkspaceId) {
  let workspaces = [];
  try {
    const getWorkspaceList = readProperty(workspaceManager, "getWorkspaces");
    workspaces =
      typeof getWorkspaceList == "function"
        ? Array.from(getWorkspaceList.call(workspaceManager) ?? [])
        : [];
  } catch {
    workspaces = [];
  }

  return workspaces
    .map((workspace, index) =>
      normalizeWorkspace(workspace, activeWorkspaceId, index)
    )
    .filter(workspace => workspace.id);
}

function getTabId(tab, position) {
  return getStableTabId(tab) || `tab-${position}`;
}

function getStableTabId(tab) {
  return (
    readAttribute(tab, "linkedpanel") ||
    readString(readProperty(tab, "linkedPanel")) ||
    readAttribute(tab, "id")
  );
}

function getTabPosition(tab, fallbackPosition) {
  const tabPosition = readProperty(tab, "_tPos");
  const elementIndex = readProperty(tab, "elementIndex");
  return Number.isInteger(tabPosition)
    ? tabPosition
    : Number.isInteger(elementIndex)
      ? elementIndex
      : fallbackPosition;
}

function tabBelongsToWorkspace(tab, activeWorkspaceId) {
  if (!activeWorkspaceId) {
    return true;
  }

  const workspaceId = readAttribute(tab, "zen-workspace-id");
  return (
    !workspaceId ||
    workspaceId === activeWorkspaceId ||
    hasAttribute(tab, "zen-essential")
  );
}

function getGroupId(group) {
  return readString(readProperty(group, "id") || readAttribute(group, "id"));
}

function normalizeTab(tab, selectedTab, index) {
  const position = getTabPosition(tab, index);
  const workspaceId = readAttribute(tab, "zen-workspace-id");
  const group = readProperty(tab, "group", null);
  const splitView =
    readBoolProperty(tab, "splitView") ||
    hasAttribute(tab, "split-view") ||
    hasAttribute(group, "split-view-group");
  const selected =
    tab === selectedTab ||
    readBoolProperty(tab, "selected") ||
    hasAttribute(tab, "selected") ||
    hasAttribute(tab, "visuallyselected");
  const favicon =
    readAttribute(tab, "image") ||
    readString(readProperty(tab, "image")) ||
    readAttribute(tab, "pendingicon");

  return {
    id: getTabId(tab, position),
    position,
    workspaceId,
    title:
      readString(readProperty(tab, "label")) ||
      readAttribute(tab, "label") ||
      readString(readNestedProperty(tab, ["linkedBrowser", "contentTitle"])),
    favicon,
    image: favicon,
    pinned: readBoolProperty(tab, "pinned") || hasAttribute(tab, "pinned"),
    essential: hasAttribute(tab, "zen-essential"),
    active: selected,
    selected,
    hidden: readBoolProperty(tab, "hidden") || hasAttribute(tab, "hidden"),
    closing: readBoolProperty(tab, "closing") || hasAttribute(tab, "closing"),
    busy: readBoolProperty(tab, "busy") || hasAttribute(tab, "busy"),
    loading: readBoolProperty(tab, "busy") || hasAttribute(tab, "busy"),
    pending: readBoolProperty(tab, "pending") || hasAttribute(tab, "pending"),
    muted:
      readBoolProperty(tab, "muted") ||
      !!readNestedProperty(tab, ["linkedBrowser", "audioMuted"], false) ||
      hasAttribute(tab, "muted"),
    soundPlaying:
      readBoolProperty(tab, "soundPlaying") ||
      hasAttribute(tab, "soundplaying"),
    activeMediaBlocked:
      readBoolProperty(tab, "activeMediaBlocked") ||
      hasAttribute(tab, "activemedia-blocked"),
    splitView,
    splitViewValue: readString(readProperty(tab, "splitViewValue")),
    splitViewGroupId: splitView ? getGroupId(group) : "",
    groupId: getGroupId(group),
    groupLabel: readString(readProperty(group, "label")),
  };
}

export function buildZenSplitCompanionSnapshot({
  browser = defaultBrowser(),
  workspaceManager = defaultWorkspaceManager(),
} = {}) {
  const activeWorkspaceId = readString(
    readProperty(workspaceManager, "activeWorkspace")
  );
  const workspaces = getWorkspaces(workspaceManager, activeWorkspaceId);
  const activeWorkspace =
    workspaces.find(workspace => workspace.active) ?? {
      id: activeWorkspaceId,
      name: "",
      active: !!activeWorkspaceId,
      icon: "",
      containerTabId: null,
      position: -1,
    };
  const selectedTab = readProperty(browser, "selectedTab", null);
  const tabs = Array.from(readProperty(browser, "tabs", []) ?? [])
    .filter(tab => tabBelongsToWorkspace(tab, activeWorkspaceId))
    .map((tab, index) => normalizeTab(tab, selectedTab, index))
    .sort((first, second) => first.position - second.position);

  return {
    activeWorkspace,
    activeWorkspaceId,
    workspaces,
    tabs,
  };
}

export function clearZenSplitCompanionSnapshotRender(host) {
  if (!host) {
    return;
  }

  while (host.firstChild) {
    host.firstChild.remove();
  }
}

function renderWorkspaceHeader(document, snapshot) {
  const header = createCompanionElement(
    document,
    "hbox",
    "zen-split-companion-header"
  );
  const title = createCompanionElement(
    document,
    "label",
    "zen-split-companion-workspace-title"
  );
  const count = createCompanionElement(
    document,
    "label",
    "zen-split-companion-tab-count"
  );
  const activeWorkspaceName = readString(snapshot.activeWorkspace?.name);
  const activeWorkspaceId = readString(snapshot.activeWorkspaceId);
  const workspaceTitle = activeWorkspaceName || activeWorkspaceId;

  setLabelValue(title, workspaceTitle);
  setLabelValue(count, readString(snapshot.tabs?.length ?? 0));

  header.append(title, count);
  return header;
}

function renderWorkspaceRow(document, workspace) {
  const row = createCompanionElement(
    document,
    "hbox",
    "zen-split-companion-workspace-row"
  );
  const icon = createCompanionElement(
    document,
    "label",
    "zen-split-companion-workspace-icon"
  );
  const name = createCompanionElement(
    document,
    "label",
    "zen-split-companion-workspace-name"
  );
  const workspaceName = readString(workspace.name) || readString(workspace.id);

  row.setAttribute("role", "button");
  row.setAttribute("aria-current", workspace.active ? "true" : "false");
  row.setAttribute("aria-disabled", workspace.active ? "true" : "false");
  row.tabIndex = 0;
  setDataAttribute(row, "data-zen-workspace-id", workspace.id);
  setDataAttribute(row, "data-zen-position", workspace.position);
  setStateAttribute(row, "data-zen-workspace-active", workspace.active);

  setLabelValue(icon, workspace.icon);
  icon.setAttribute("crop", "end");
  setLabelValue(name, workspaceName);
  name.setAttribute("crop", "end");

  row.append(icon, name);
  return row;
}

function renderWorkspaceList(document, snapshot) {
  const list = createCompanionElement(
    document,
    "vbox",
    "zen-split-companion-workspace-list"
  );
  list.setAttribute("role", "list");

  for (const workspace of snapshot.workspaces ?? []) {
    list.append(renderWorkspaceRow(document, workspace));
  }

  return list;
}

function renderTabIcon(document, tab) {
  const stack = createCompanionElement(
    document,
    "hbox",
    "zen-split-companion-tab-icon-stack"
  );
  const favicon = readString(tab.image || tab.favicon);

  if (favicon) {
    const image = createCompanionElement(
      document,
      "image",
      "zen-split-companion-tab-icon"
    );
    image.setAttribute("src", favicon);
    stack.append(image);
  } else {
    stack.setAttribute("icon-placeholder", "true");
  }

  return stack;
}

function renderTabLabel(document, tab) {
  const labels = createCompanionElement(
    document,
    "vbox",
    "zen-split-companion-tab-labels"
  );
  const title = createCompanionElement(
    document,
    "label",
    "zen-split-companion-tab-title"
  );
  setLabelValue(title, tab.title);
  title.setAttribute("crop", "end");
  labels.append(title);

  if (tab.groupLabel) {
    const group = createCompanionElement(
      document,
      "label",
      "zen-split-companion-tab-group-label"
    );
    setLabelValue(group, tab.groupLabel);
    group.setAttribute("crop", "end");
    labels.append(group);
  }

  return labels;
}

function renderTabIndicators(document, tab) {
  const indicators = createCompanionElement(
    document,
    "hbox",
    "zen-split-companion-tab-indicators"
  );

  for (const [name, active] of [
    ["busy", tab.busy || tab.loading],
    ["pending", tab.pending],
    ["muted", tab.muted],
    ["soundplaying", tab.soundPlaying],
    ["activemedia-blocked", tab.activeMediaBlocked],
    ["split-view", tab.splitView],
  ]) {
    if (!active) {
      continue;
    }

    const indicator = createCompanionElement(
      document,
      "box",
      "zen-split-companion-tab-indicator"
    );
    indicator.setAttribute("data-zen-indicator", name);
    indicators.append(indicator);
  }

  return indicators;
}

function renderTabRow(document, tab) {
  const row = createCompanionElement(
    document,
    "hbox",
    "zen-split-companion-tab-row"
  );
  row.setAttribute("role", "option");
  row.setAttribute("aria-selected", tab.selected || tab.active ? "true" : "false");
  row.tabIndex = -1;

  setDataAttribute(row, "data-zen-tab-id", tab.id);
  setDataAttribute(row, "data-zen-position", tab.position);
  setDataAttribute(row, "data-zen-workspace-id", tab.workspaceId);
  setDataAttribute(row, "data-zen-group-id", tab.groupId);
  setDataAttribute(row, "data-zen-group-label", tab.groupLabel);
  setDataAttribute(row, "data-zen-split-view-value", tab.splitViewValue);
  setDataAttribute(
    row,
    "data-zen-split-view-group-id",
    tab.splitViewGroupId
  );

  for (const [name, value] of [
    ["selected", tab.selected],
    ["active", tab.active],
    ["pinned", tab.pinned],
    ["zen-essential", tab.essential],
    ["data-zen-hidden", tab.hidden],
    ["closing", tab.closing],
    ["busy", tab.busy],
    ["loading", tab.loading],
    ["pending", tab.pending],
    ["muted", tab.muted],
    ["soundplaying", tab.soundPlaying],
    ["activemedia-blocked", tab.activeMediaBlocked],
    ["split-view", tab.splitView],
  ]) {
    setStateAttribute(row, name, value);
  }

  row.append(
    renderTabIcon(document, tab),
    renderTabLabel(document, tab),
    renderTabIndicators(document, tab)
  );
  return row;
}

export function renderZenSplitCompanionSnapshot(host, snapshot) {
  clearZenSplitCompanionSnapshotRender(host);
  if (!host || !snapshot) {
    return null;
  }

  const document = host.ownerDocument;
  const root = createCompanionElement(
    document,
    "vbox",
    "zen-split-companion-render"
  );
  const list = createCompanionElement(
    document,
    "vbox",
    "zen-split-companion-tab-list"
  );
  list.setAttribute("role", "listbox");
  list.setAttribute("aria-readonly", "true");

  for (const tab of snapshot.tabs ?? []) {
    list.append(renderTabRow(document, tab));
  }

  root.append(renderWorkspaceHeader(document, snapshot));
  if (snapshot.workspaces?.length) {
    root.append(renderWorkspaceList(document, snapshot));
  }
  root.append(list);
  host.append(root);
  return root;
}

class nsZenSplitCompanionPane extends nsZenDOMOperatedFeature {
  #attachedBrowser = null;
  #attachedWorkspaceManager = null;
  #clickEventListener = null;
  #host = null;
  #keydownEventListener = null;
  #pendingRefreshFrame = 0;
  #prefObserver = null;
  #refreshEventListener = null;
  #snapshot = null;
  #tabsProgressListener = null;
  #workspaceChangeListener = null;

  init() {
    const host = document.getElementById("zen-split-companion-pane");
    if (!host) {
      return;
    }

    if (this.#prefObserver) {
      this.#moveClickListenerToHost(host);
      this.#updateState();
      return;
    }

    this.#host = host;
    this.#prefObserver = this.#updateState.bind(this);
    for (const pref of Object.values(kPrefs)) {
      Services.prefs.addObserver(pref, this.#prefObserver);
    }
    this.#clickEventListener = this.#handleClick.bind(this);
    this.#host.addEventListener("click", this.#clickEventListener);
    this.#keydownEventListener = this.#handleKeyDown.bind(this);
    this.#host.addEventListener("keydown", this.#keydownEventListener);
    window.addEventListener("unload", this, { once: true });
    this.#attachRefreshListeners();

    this.#updateState();
  }

  #moveClickListenerToHost(host) {
    if (host === this.#host) {
      return;
    }

    if (this.#clickEventListener && this.#host) {
      this.#host.removeEventListener("click", this.#clickEventListener);
    }
    if (this.#keydownEventListener && this.#host) {
      this.#host.removeEventListener("keydown", this.#keydownEventListener);
    }
    this.#host = host;
    if (this.#clickEventListener) {
      this.#host.addEventListener("click", this.#clickEventListener);
    }
    if (this.#keydownEventListener) {
      this.#host.addEventListener("keydown", this.#keydownEventListener);
    }
  }

  handleEvent(event) {
    if (event.type === "unload") {
      this.destroy();
    }
  }

  destroy() {
    if (this.#prefObserver) {
      for (const pref of Object.values(kPrefs)) {
        Services.prefs.removeObserver(pref, this.#prefObserver);
      }
      this.#prefObserver = null;
    }
    window.removeEventListener("unload", this);
    if (this.#clickEventListener && this.#host) {
      this.#host.removeEventListener("click", this.#clickEventListener);
      this.#clickEventListener = null;
    }
    if (this.#keydownEventListener && this.#host) {
      this.#host.removeEventListener("keydown", this.#keydownEventListener);
      this.#keydownEventListener = null;
    }
    this.#detachRefreshListeners();
    this.#cancelScheduledRefresh();
    this.#snapshot = null;
    clearZenSplitCompanionSnapshotRender(this.#host);
    if (this.#host) {
      this.#host.hidden = true;
      this.#host.removeAttribute("zen-split-companion-enabled");
      this.#host.removeAttribute("zen-split-companion-pane-visible");
      this.#host.removeAttribute("zen-split-companion-right-web-visible");
      clearRightWebVisibilityFailure(this.#host);
    }
  }

  get snapshot() {
    return this.#snapshot;
  }

  buildSnapshot() {
    this.#snapshot = buildZenSplitCompanionSnapshot();
    return this.#snapshot;
  }

  #attachRefreshListeners() {
    if (this.#refreshEventListener) {
      return;
    }

    this.#refreshEventListener = this.#refreshFromSignal.bind(this);
    for (const eventName of ZEN_SPLIT_COMPANION_REFRESH_EVENTS) {
      window.addEventListener(eventName, this.#refreshEventListener);
    }

    this.#workspaceChangeListener = this.#refreshFromSignal.bind(this);
    const workspaceManager = defaultWorkspaceManager();
    if (typeof workspaceManager?.addChangeListeners == "function") {
      workspaceManager.addChangeListeners(this.#workspaceChangeListener);
      this.#attachedWorkspaceManager = workspaceManager;
    }

    this.#tabsProgressListener = {
      onLocationChange: this.#refreshFromSignal.bind(this),
      onStateChange: this.#refreshFromSignal.bind(this),
      onLinkIconAvailable: this.#refreshFromSignal.bind(this),
    };
    const browser = defaultBrowser();
    if (typeof browser?.addTabsProgressListener == "function") {
      browser.addTabsProgressListener(this.#tabsProgressListener);
      this.#attachedBrowser = browser;
    }
  }

  #detachRefreshListeners() {
    if (this.#refreshEventListener) {
      for (const eventName of ZEN_SPLIT_COMPANION_REFRESH_EVENTS) {
        window.removeEventListener(eventName, this.#refreshEventListener);
      }
      this.#refreshEventListener = null;
    }

    if (
      this.#workspaceChangeListener &&
      typeof this.#attachedWorkspaceManager?.removeChangeListeners == "function"
    ) {
      this.#attachedWorkspaceManager.removeChangeListeners(
        this.#workspaceChangeListener
      );
    }
    this.#workspaceChangeListener = null;
    this.#attachedWorkspaceManager = null;

    if (
      this.#tabsProgressListener &&
      typeof this.#attachedBrowser?.removeTabsProgressListener == "function"
    ) {
      this.#attachedBrowser.removeTabsProgressListener(this.#tabsProgressListener);
    }
    this.#tabsProgressListener = null;
    this.#attachedBrowser = null;
  }

  #isVisible() {
    return (
      !!this.#host &&
      Services.prefs.getBoolPref(kPrefs.enabled, false) &&
      Services.prefs.getBoolPref(kPrefs.paneVisible, false)
    );
  }

  #refreshFromSignal() {
    if (!this.#isVisible()) {
      return;
    }

    if (this.#pendingRefreshFrame) {
      return;
    }

    this.#pendingRefreshFrame = requestAnimationFrame(() => {
      this.#pendingRefreshFrame = 0;
      if (!this.#isVisible()) {
        return;
      }

      renderZenSplitCompanionSnapshot(this.#host, this.buildSnapshot());
    });
  }

  #cancelScheduledRefresh() {
    if (!this.#pendingRefreshFrame) {
      return;
    }

    cancelAnimationFrame(this.#pendingRefreshFrame);
    this.#pendingRefreshFrame = 0;
  }

  #handleClick(event) {
    if (event.button !== 0) {
      return;
    }

    const workspaceRow = findCompanionWorkspaceRow(event.target, this.#host);
    if (workspaceRow) {
      this.#handleWorkspaceSwitch(workspaceRow);
      return;
    }

    const row = findCompanionTabRow(event.target, this.#host);
    if (!row) {
      return;
    }

    const browser = defaultBrowser();
    const tab = findLiveTabForCompanionRow(row, browser);
    const viewSplitter = defaultViewSplitter();

    clearSplitActionFailure(row);

    if (!tab) {
      markSplitActionFailure(row, "tab-not-found");
      return;
    }

    if (typeof viewSplitter?.setRightSplitTab != "function") {
      markSplitActionFailure(row, "split-view-api-unavailable");
      return;
    }

    let result;
    try {
      result = viewSplitter.setRightSplitTab(tab, {
        baseTab: readProperty(browser, "selectedTab", null),
      });
    } catch (error) {
      markSplitActionFailure(row, error?.name || "split-action-failed");
      return;
    }

    if (result?.ok === false) {
      markSplitActionFailure(row, result.reason);
    }
  }

  #handleKeyDown(event) {
    if (event.defaultPrevented) {
      return;
    }

    if (
      event.key !== "Enter" &&
      event.key !== " " &&
      event.key !== "Spacebar"
    ) {
      return;
    }

    const workspaceRow = findCompanionWorkspaceRow(event.target, this.#host);
    if (!workspaceRow) {
      return;
    }

    event.preventDefault();
    this.#handleWorkspaceSwitch(workspaceRow);
  }

  #resolveWorkspaceSwitchFailureRow(row, workspaceId) {
    const currentRow = findCompanionWorkspaceRowById(workspaceId, this.#host);
    if (currentRow) {
      return currentRow;
    }

    return this.#host?.contains(row) ? row : null;
  }

  #markWorkspaceSwitchFailure(row, workspaceId, reason) {
    const failureRow = this.#resolveWorkspaceSwitchFailureRow(row, workspaceId);
    if (failureRow) {
      markWorkspaceSwitchFailure(failureRow, reason);
    }
  }

  #handleWorkspaceSwitch(row) {
    clearWorkspaceSwitchFailure(row);

    const workspaceId = readAttribute(row, "data-zen-workspace-id");
    if (!workspaceId) {
      markWorkspaceSwitchFailure(row, "workspace-not-found");
      return;
    }

    if (row.hasAttribute("data-zen-workspace-active")) {
      return;
    }

    const workspaceManager = defaultWorkspaceManager();
    if (typeof workspaceManager?.changeWorkspaceWithID != "function") {
      markWorkspaceSwitchFailure(row, "workspace-api-unavailable");
      return;
    }

    let result;
    try {
      result = workspaceManager.changeWorkspaceWithID(workspaceId, {
        source: "split-companion-pane",
      });
    } catch (error) {
      this.#markWorkspaceSwitchFailure(
        row,
        workspaceId,
        error?.name || "workspace-switch-failed"
      );
      return;
    }

    Promise.resolve(result)
      .then(resolved => {
        if (resolved?.ok === false) {
          this.#markWorkspaceSwitchFailure(row, workspaceId, resolved.reason);
        }
      })
      .catch(error => {
        this.#markWorkspaceSwitchFailure(
          row,
          workspaceId,
          error?.name || "workspace-switch-failed"
        );
      });
  }

  #syncRightWebVisibility(rightWebVisible, enabled) {
    if (!this.#host) {
      return;
    }

    if (!enabled) {
      clearRightWebVisibilityFailure(this.#host);
      return;
    }

    const viewSplitter = defaultViewSplitter();
    if (typeof viewSplitter?.setRightSplitWebVisible != "function") {
      markRightWebVisibilityFailure(this.#host, "split-view-api-unavailable");
      return;
    }

    let result;
    try {
      result = viewSplitter.setRightSplitWebVisible(rightWebVisible, {
        source: "split-companion-pref",
      });
    } catch (error) {
      markRightWebVisibilityFailure(
        this.#host,
        error?.name || "right-web-visibility-failed"
      );
      return;
    }

    if (result?.ok === false) {
      if (result.reason === "missing-active-split") {
        clearRightWebVisibilityFailure(this.#host);
        return;
      }
      markRightWebVisibilityFailure(this.#host, result.reason);
      return;
    }

    clearRightWebVisibilityFailure(this.#host);
  }

  #updateState() {
    const enabled = Services.prefs.getBoolPref(kPrefs.enabled, false);
    const paneVisible = Services.prefs.getBoolPref(kPrefs.paneVisible, false);
    const rightWebVisible = Services.prefs.getBoolPref(
      kPrefs.rightWebVisible,
      false
    );

    this.#host.toggleAttribute("zen-split-companion-enabled", enabled);
    this.#host.toggleAttribute(
      "zen-split-companion-pane-visible",
      paneVisible
    );
    this.#host.toggleAttribute(
      "zen-split-companion-right-web-visible",
      rightWebVisible
    );
    this.#syncRightWebVisibility(rightWebVisible, enabled);

    const visible = enabled && paneVisible;
    this.#host.hidden = !visible;
    if (!visible) {
      this.#snapshot = null;
      clearZenSplitCompanionSnapshotRender(this.#host);
      return;
    }

    this.#refreshFromSignal();
  }
}

window.gZenSplitCompanionPane = new nsZenSplitCompanionPane();
