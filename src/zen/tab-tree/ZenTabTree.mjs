// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { nsZenDOMOperatedFeature } from "chrome://browser/content/zen-components/ZenCommonUtils.mjs";

function domOrderOf(tabs) {
  return [...tabs].sort((a, b) => {
    const pos = a.compareDocumentPosition(b);
    if (pos & Node.DOCUMENT_POSITION_FOLLOWING) {
      return -1;
    }
    if (pos & Node.DOCUMENT_POSITION_PRECEDING) {
      return 1;
    }
    return 0;
  });
}

class nsZenTabTree extends nsZenDOMOperatedFeature {
  #enabled = false;

  // Guard so our own DOM moves don't re-enter on_TabMove.
  _suppressMoveHandling = false;

  // True while a user drag is in flight; the drop handler owns tree fixup then,
  // so the per-move neighbor heuristic is suppressed (it would flatten a branch
  // moved as a group). Programmatic moves (no drag) still go through on_TabMove.
  _dragActive = false;

  // The root tab of an auto-selected branch drag, so dragend can restore it.
  _branchDragRoot = null;

  init() {
    this.#enabled =
      Services.prefs.getBoolPref("zen.tab-tree.enabled", true) &&
      !gZenWorkspaces.privateWindowOrDisabled;
    if (!this.#enabled) {
      return;
    }
    this.#initEventListeners();
  }

  get enabled() {
    return this.#enabled;
  }

  #initEventListeners() {
    window.addEventListener("TabOpen", this);
    window.addEventListener("TabClose", this);
    window.addEventListener("TabMove", this);
    window.addEventListener("TabPinned", this);
    window.addEventListener("SSWindowStateReady", this);
  }

  handleEvent(aEvent) {
    const methodName = `on_${aEvent.type}`;
    if (methodName in this) {
      this[methodName](aEvent);
    }
  }

  get #indentStep() {
    return Services.prefs.getIntPref("zen.tab-tree.indent", 14);
  }

  get #maxDepth() {
    return Services.prefs.getIntPref("zen.tab-tree.max-depth", 4);
  }

  // --- queries ---

  isTreeEligible(tab) {
    return (
      gBrowser.isTab(tab) &&
      !tab.pinned &&
      !tab.hasAttribute("zen-essential") &&
      !tab.hasAttribute("zen-glance-tab") &&
      !tab.hasAttribute("zen-empty-tab") &&
      !tab.hasAttribute("zen-live-folder-item-id") &&
      !tab.group?.hasAttribute("split-view-group")
    );
  }

  getParent(tab) {
    const parent = tab?._zenTreeParent;
    return parent && parent.isConnected ? parent : null;
  }

  getLevel(tab) {
    let level = 0;
    let node = this.getParent(tab);
    while (node) {
      level++;
      node = this.getParent(node);
    }
    return level;
  }

  getChildren(tab) {
    // Children in DOM order. Tree relationships only span same-workspace tabs.
    return domOrderOf(gBrowser.tabs.filter(t => this.getParent(t) === tab));
  }

  getDescendants(tab) {
    const out = [];
    for (const child of this.getChildren(tab)) {
      out.push(child, ...this.getDescendants(child));
    }
    return out;
  }

  // Recompute cached level + indentation + twisty for `root` and descendants.
  reindex(root) {
    const apply = (tab, level) => {
      tab._zenTreeLevel = level;
      this.#applyIndent(tab, level);
      const parent = this.getParent(tab);
      if (parent) {
        tab.setAttribute("zen-tree-parent-id", parent.id || "");
      } else {
        tab.removeAttribute("zen-tree-parent-id");
      }
      this.#updateTwisty(tab);
      for (const child of this.getChildren(tab)) {
        apply(child, level + 1);
      }
    };
    apply(root, this.getLevel(root));
  }

  #applyIndent(tab, level) {
    tab.style.setProperty(
      "--zen-folder-indent",
      `${level * this.#indentStep}px`
    );
  }

  // --- tree mutations ---

  // Move `tab` (and its entire subtree) to become the last child of `parent`.
  nestTab(tab, parent, { position = "end" } = {}) {
    if (
      tab === parent ||
      !this.isTreeEligible(tab) ||
      !this.isTreeEligible(parent) ||
      this.#isAncestor(tab, parent) || // prevent cycles
      tab.getAttribute("zen-workspace-id") !==
        parent.getAttribute("zen-workspace-id")
    ) {
      return false;
    }

    const previousParent = this.getParent(tab);
    const subtree = [tab, ...this.getDescendants(tab)]; // already DFS order
    tab._zenTreeParent = parent;

    // Determine insertion reference within the strip.
    let reference;
    if (position === "start") {
      reference = parent; // first child goes right after the parent
    } else {
      const existing = this.getChildren(parent).filter(c => c !== tab);
      const lastChild = existing[existing.length - 1];
      reference = lastChild ? this.#lastSubtreeNode(lastChild) : parent;
    }

    this.#moveSubtreeAfter(subtree, reference);
    const root = this.#rootOf(parent);
    this.reindex(root);
    this.clampDepth(root);
    if (previousParent && previousParent !== parent) {
      this.reindex(this.#rootOf(previousParent));
    }
    this.#onTreeChanged(tab);
    return true;
  }

  // Re-parent `tab` to its grandparent (or root). Subtree follows.
  promoteSubtree(tab) {
    const grandparent = this.getParent(this.getParent(tab));
    if (grandparent) {
      this.nestTab(tab, grandparent, { position: "end" });
    } else {
      this.detachTab(tab);
    }
  }

  // Make `tab` a root: clear its parent, leave its subtree intact beneath it.
  detachTab(tab) {
    if (!this.getParent(tab)) {
      return;
    }
    tab._zenTreeParent = null;
    this.reindex(tab);
    this.#onTreeChanged(tab);
  }

  // Make every tab in `tabs` a DIRECT child (one level) of `parent`.
  // Each tab keeps its own subtree. Order follows `tabs` order.
  nestTabsAsChildren(tabs, parent) {
    const eligible = tabs.filter(
      t =>
        t !== parent && this.isTreeEligible(t) && !this.#isAncestor(t, parent)
    );
    for (const t of eligible) {
      this.nestTab(t, parent, { position: "end" });
    }
  }

  // Flatten any descendants of `root` whose level exceeds max-depth.
  // Deepest-first: a node beyond the cap is re-parented to the nearest
  // ancestor at (max-depth - 1), collapsing overflow at the cap boundary.
  clampDepth(root) {
    const max = this.#maxDepth;
    if (max <= 0) {
      return; // cap disabled
    }
    let changed = false;
    // getDescendants() returns DFS order so parents precede their children.
    for (const node of this.getDescendants(root)) {
      if (this.getLevel(node) > max) {
        const anchor = this.#ancestorAtLevel(node, max - 1);
        if (anchor && this.getParent(node) !== anchor) {
          node._zenTreeParent = anchor;
          changed = true;
        }
      }
    }
    if (changed) {
      this.reindex(root);
    }
  }

  // The "roots" of a dragged set: dragged tabs whose parent is NOT also in the
  // set. Their subtrees travel with them and keep their internal hierarchy.
  #draggedRoots(draggedTabs) {
    const tabs = draggedTabs.filter(t => this.isTreeEligible(t));
    const set = new Set(tabs);
    return domOrderOf(tabs.filter(t => !set.has(this.getParent(t))));
  }

  // Entry point used by the drag-and-drop drop handler for a NEST drop.
  // A single dragged root nests under the target keeping its hierarchy;
  // multiple roots each become a direct child of the target (subtrees follow).
  handleNestDrop(draggedTabs, target) {
    if (!this.enabled || !this.isTreeEligible(target)) {
      return false;
    }
    const roots = this.#draggedRoots(draggedTabs);
    if (!roots.length) {
      return false;
    }
    if (roots.length === 1) {
      return this.nestTab(roots[0], target);
    }
    this.nestTabsAsChildren(roots, target);
    return true;
  }

  // Entry point for a plain REORDER drop. The native move already placed the
  // dragged tabs at the new spot; make each dragged root a sibling there
  // (parent = the eligible tab just above the moved block), preserving each
  // root's internal subtree. Used for both single-tab and multi-tab reorders.
  handleReorderDrop(draggedTabs) {
    if (!this.enabled) {
      return;
    }
    const roots = this.#draggedRoots(draggedTabs);
    if (!roots.length) {
      return;
    }
    const set = new Set(draggedTabs);
    let prev = roots[0].previousElementSibling;
    while (prev && (!this.isTreeEligible(prev) || set.has(prev))) {
      prev = prev.previousElementSibling;
    }
    const newParent = prev ? this.getParent(prev) : null;
    const affected = new Set();
    for (const root of roots) {
      if (
        newParent === root ||
        this.#isAncestor(root, newParent) ||
        this.getParent(root) === newParent
      ) {
        affected.add(this.#rootOf(root));
        continue;
      }
      root._zenTreeParent = newParent;
      affected.add(this.#rootOf(root));
    }
    for (const r of affected) {
      this.reindex(r);
    }
    this.#onTreeChanged(roots[0]);
  }

  // --- collapse / expand ---

  setCollapsed(tab, collapsed) {
    if (!this.getChildren(tab).length) {
      return; // nothing to collapse
    }
    tab._zenTreeCollapsed = collapsed;
    tab.toggleAttribute("zen-tree-collapsed", collapsed);

    const descendants = this.getDescendants(tab);
    for (const d of descendants) {
      // A descendant is hidden if ANY ancestor up to `tab` is collapsed.
      d.toggleAttribute("zen-tree-hidden", this.#isHiddenByCollapse(d));
    }

    if (
      collapsed &&
      gBrowser.selectedTab &&
      descendants.includes(gBrowser.selectedTab)
    ) {
      gBrowser.selectedTab = tab; // nearest visible ancestor
    }

    this.#updateTwisty(tab);
    this.#onTreeChanged(tab);
  }

  toggleCollapse(tab) {
    this.setCollapsed(tab, !tab._zenTreeCollapsed);
  }

  #isHiddenByCollapse(tab) {
    let node = this.getParent(tab);
    while (node) {
      if (node._zenTreeCollapsed) {
        return true;
      }
      node = this.getParent(node);
    }
    return false;
  }

  // Ensure a clickable twisty exists on parent tabs (and not on leaves).
  #updateTwisty(tab) {
    const hasChildren = this.getChildren(tab).length > 0;
    let twisty = tab.querySelector(".zen-tree-twisty");
    if (hasChildren && !twisty) {
      twisty = document.createXULElement("image");
      twisty.className = "zen-tree-twisty";
      twisty.addEventListener("mousedown", e => {
        e.stopPropagation();
        e.preventDefault();
        this.toggleCollapse(tab);
      });
      tab.insertBefore(twisty, tab.firstChild);
    } else if (!hasChildren && twisty) {
      twisty.remove();
    }
    tab.toggleAttribute("zen-tree-parent", hasChildren);
  }

  // --- internal helpers ---

  #isAncestor(maybeAncestor, tab) {
    let node = this.getParent(tab);
    while (node) {
      if (node === maybeAncestor) {
        return true;
      }
      node = this.getParent(node);
    }
    return false;
  }

  #rootOf(tab) {
    let node = tab;
    while (this.getParent(node)) {
      node = this.getParent(node);
    }
    return node;
  }

  // Last tab (deepest, last) in `tab`'s subtree, in DFS order.
  #lastSubtreeNode(tab) {
    const desc = this.getDescendants(tab);
    return desc.length ? desc[desc.length - 1] : tab;
  }

  #ancestorAtLevel(tab, level) {
    let node = tab;
    while (node && this.getLevel(node) > level) {
      node = this.getParent(node);
    }
    return node;
  }

  // Insert each subtree node, in order, immediately after `reference`,
  // advancing the reference so the block stays contiguous.
  #moveSubtreeAfter(subtree, reference) {
    this._suppressMoveHandling = true;
    let ref = reference;
    for (const node of subtree) {
      if (node !== ref && node.previousElementSibling !== ref) {
        ref.after(node);
      }
      ref = node;
    }
    gBrowser.tabContainer._invalidateCachedTabs();
    this._suppressMoveHandling = false;
  }

  // After a plain reorder, set tab's parent to that of its previous visible
  // sibling (or root at container start).
  #reparentFromNeighbor(tab) {
    if (!this.isTreeEligible(tab)) {
      return;
    }
    let prev = tab.previousElementSibling;
    while (prev && !this.isTreeEligible(prev)) {
      prev = prev.previousElementSibling;
    }
    const newParent = prev ? this.getParent(prev) : null;
    if (newParent === tab || this.#isAncestor(tab, newParent)) {
      return; // never create a cycle
    }
    if (this.getParent(tab) !== newParent) {
      tab._zenTreeParent = newParent;
      this.reindex(this.#rootOf(tab));
      this.#onTreeChanged(tab);
    }
  }

  // Fire a change so window-sync can replicate the new tree state.
  #onTreeChanged(tab) {
    if (tab && tab.isConnected) {
      tab.dispatchEvent(new CustomEvent("ZenTreeChanged", { bubbles: true }));
    }
  }

  // --- lifecycle event handlers ---

  on_TabOpen(event) {
    if (
      !this.enabled ||
      !Services.prefs.getBoolPref("zen.tab-tree.auto-nest-by-opener", true)
    ) {
      return;
    }
    const tab = event.target;
    // `owner` is Firefox's opener-tab relationship for tabs opened from
    // another tab (link-in-new-tab, ctrl/middle click).
    const opener = tab.owner;
    if (
      !opener ||
      !this.isTreeEligible(tab) ||
      !this.isTreeEligible(opener) ||
      tab.getAttribute("zen-workspace-id") !==
        opener.getAttribute("zen-workspace-id")
    ) {
      return;
    }
    this.nestTab(tab, opener);
  }

  on_TabClose(event) {
    if (!this.enabled) {
      return;
    }
    const tab = event.target;
    const children = this.getChildren(tab);
    if (!children.length) {
      return;
    }
    const behavior = Services.prefs.getStringPref(
      "zen.tab-tree.close-parent-behavior",
      "promote"
    );
    if (behavior === "close-subtree") {
      const subtree = this.getDescendants(tab);
      // Defer so the current close finishes first.
      window.setTimeout(() => {
        gBrowser.removeTabs(
          subtree.filter(t => t.isConnected && !t.closing),
          { animate: true }
        );
      }, 0);
      return;
    }
    // promote: re-parent each direct child to the closing tab's parent.
    const newParent = this.getParent(tab);
    for (const child of children) {
      child._zenTreeParent = newParent;
    }
    const roots = new Set();
    if (newParent) {
      roots.add(this.#rootOf(newParent));
    } else {
      for (const child of children) {
        roots.add(child);
      }
    }
    for (const root of roots) {
      this.reindex(root);
    }
    this.#onTreeChanged(tab);
  }

  on_TabPinned(event) {
    if (!this.enabled) {
      return;
    }
    const tab = event.target;
    const children = this.getChildren(tab);
    const newParent = this.getParent(tab);
    // Promote children to the tab's parent, then detach the tab itself.
    for (const child of children) {
      child._zenTreeParent = newParent;
    }
    tab._zenTreeParent = null;
    tab._zenTreeCollapsed = false;
    tab.removeAttribute("zen-tree-parent-id");
    tab.removeAttribute("zen-tree-collapsed");
    tab.removeAttribute("zen-tree-hidden");
    tab.style.removeProperty("--zen-folder-indent");
    this.#updateTwisty(tab);

    const roots = new Set();
    if (newParent) {
      roots.add(this.#rootOf(newParent));
    } else {
      for (const child of children) {
        roots.add(child); // each promoted to root
      }
    }
    for (const root of roots) {
      this.reindex(root);
    }
    this.#onTreeChanged(tab);
  }

  on_TabMove(event) {
    // During a user drag the drop handler owns tree fixup (handleReorderDrop /
    // handleNestDrop). Only handle programmatic moves (e.g. gBrowser.moveTabTo).
    if (!this.enabled || this._suppressMoveHandling || this._dragActive) {
      return;
    }
    const tab = event.target;
    if (!this.isTreeEligible(tab)) {
      return;
    }
    // A programmatic move relocates only this tab. If it has a subtree, bring
    // the whole subtree along so it stays contiguous, then re-derive the parent.
    const descendants = this.getDescendants(tab);
    if (descendants.length) {
      this.#moveSubtreeAfter([tab, ...descendants], tab);
    }
    this.#reparentFromNeighbor(tab);
  }

  // --- persistence ---

  on_SSWindowStateReady() {
    this.rebuildFromAttributes();
  }

  // Reconnect _zenTreeParent pointers from persisted zen-tree-parent-id, then
  // re-apply levels, indentation, collapse hiding, and twisties.
  rebuildFromAttributes() {
    if (!this.enabled) {
      return;
    }
    const byId = new Map();
    for (const tab of gBrowser.tabs) {
      if (tab.id) {
        byId.set(tab.id, tab);
      }
    }
    for (const tab of gBrowser.tabs) {
      const pid = tab.getAttribute("zen-tree-parent-id");
      const parent = pid ? byId.get(pid) : null;
      tab._zenTreeParent =
        parent && parent !== tab && this.isTreeEligible(tab) ? parent : null;
      tab._zenTreeCollapsed = tab.hasAttribute("zen-tree-collapsed");
    }
    // Reindex all roots, then re-apply collapse hiding for collapsed nodes.
    for (const tab of gBrowser.tabs) {
      if (this.isTreeEligible(tab) && !this.getParent(tab)) {
        this.reindex(tab);
      }
    }
    for (const tab of gBrowser.tabs) {
      if (tab._zenTreeCollapsed) {
        for (const d of this.getDescendants(tab)) {
          d.toggleAttribute("zen-tree-hidden", this.#isHiddenByCollapse(d));
        }
      }
    }
  }
}

window.gZenTabTree = new nsZenTabTree();
