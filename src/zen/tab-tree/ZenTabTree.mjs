// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { nsZenDOMOperatedFeature } from "chrome://browser/content/zen-components/ZenCommonUtils.mjs";

function domOrderOf(nodes) {
  return [...nodes].sort((a, b) => {
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

// A tree "node" is either a standalone tab or a split-view group element. The
// split group is treated as one unit: it nests, indents, moves and collapses as
// a single row, and its inner tabs never participate in the tree on their own.
class nsZenTabTree extends nsZenDOMOperatedFeature {
  #enabled = false;

  // Guard so our own DOM moves don't re-enter on_TabMove.
  _suppressMoveHandling = false;

  // True while a user drag is in flight; the drop handler owns tree fixup then,
  // so the per-move neighbor heuristic is suppressed (it would flatten a branch
  // moved as a group). Programmatic moves (no drag) still go through on_TabMove.
  _dragActive = false;

  _branchDragRoot = null;

  // Coalesces the attribute-driven rebuild across a burst of tab restores
  // (Ctrl+Shift+T can bring several closed tabs back in quick succession).
  #rebuildScheduled = false;

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
    window.addEventListener("TabGrouped", this);
    window.addEventListener("TabUngrouped", this);
    window.addEventListener("SSWindowStateReady", this);
    window.addEventListener("SSTabRestored", this);
  }

  handleEvent(aEvent) {
    const methodName = `on_${aEvent.type}`;
    if (methodName in this) {
      this[methodName](aEvent);
    }
  }

  get #indentStep() {
    return Services.prefs.getIntPref("zen.tab-tree.indent", 20);
  }

  get #maxDepth() {
    return Services.prefs.getIntPref("zen.tab-tree.max-depth", 4);
  }

  #isSplitGroup(el) {
    return !!el && gBrowser.isTabGroup(el) && el.hasAttribute("split-view-group");
  }

  // The node that owns a tab: its split group if it is in one, else the tab.
  #nodeOf(tab) {
    const group = tab?.group;
    return group?.hasAttribute("split-view-group") ? group : tab;
  }

  // Every tree node (standalone tabs + split groups) in DOM order.
  #nodes() {
    const out = [];
    const seen = new Set();
    for (const tab of gBrowser.tabs) {
      const node = this.#nodeOf(tab);
      if (node && !seen.has(node)) {
        seen.add(node);
        out.push(node);
      }
    }
    return out;
  }

  // A tab to activate when a node is selected (split group's active/first tab).
  #representativeTab(node) {
    if (this.#isSplitGroup(node)) {
      return (
        node.querySelector(".tabbrowser-tab[visuallyselected]") ||
        node.querySelector(".tabbrowser-tab")
      );
    }
    return node;
  }

  #workspaceIdOf(node) {
    return (
      node.getAttribute?.("zen-workspace-id") ||
      this.#representativeTab(node)?.getAttribute("zen-workspace-id") ||
      null
    );
  }

  // The tree node that owns a tab (its split group, or the tab itself). Public
  // so the drag handler can target split groups as single nodes.
  treeNodeFor(tab) {
    return this.#nodeOf(tab);
  }

  isSplitGroup(el) {
    return this.#isSplitGroup(el);
  }

  // Representative tab of the last eligible non-dragged node, so a drag below the
  // list can target its bottom edge to reorder/outdent there.
  lastDropTab(exclude) {
    const nodes = this.#nodes().filter(
      n => this.isTreeEligible(n) && !exclude?.has(n)
    );
    const last = nodes[nodes.length - 1];
    return last ? this.#representativeTab(last) : null;
  }

  isTreeEligible(node) {
    if (this.#isSplitGroup(node)) {
      return !node.pinned && !node.hasAttribute("zen-essential");
    }
    return (
      gBrowser.isTab(node) &&
      !node.group &&
      !node.pinned &&
      !node.hasAttribute("zen-essential") &&
      !node.hasAttribute("zen-glance-tab") &&
      !node.hasAttribute("zen-empty-tab") &&
      !node.hasAttribute("zen-live-folder-item-id")
    );
  }

  getParent(node) {
    const parent = node?._zenTreeParent;
    return parent && parent.isConnected ? parent : null;
  }

  getLevel(node) {
    let level = 0;
    let current = this.getParent(node);
    while (current) {
      level++;
      current = this.getParent(current);
    }
    return level;
  }

  getChildren(node) {
    return domOrderOf(this.#nodes().filter(n => this.getParent(n) === node));
  }

  getDescendants(node) {
    const out = [];
    for (const child of this.getChildren(node)) {
      out.push(child, ...this.getDescendants(child));
    }
    return out;
  }

  // Nodes pointing at `node` by raw parent pointer (used during lifecycle fixup,
  // before eligibility is settled).
  #childrenByPointer(node) {
    return this.#nodes().filter(n => n._zenTreeParent === node);
  }

  reindex(root) {
    const apply = (node, level, hidden) => {
      node._zenTreeLevel = level;
      this.#applyIndent(node, level);
      // Hide a node nested under a collapsed parent immediately (and shed a stale
      // flag when moved out), without waiting for the next setCollapsed.
      node.toggleAttribute("zen-tree-hidden", hidden);
      // Stable identity for parent references: window-sync reassigns the live
      // `id` on restore, so children match their parent by this persisted id.
      if (node.id) {
        node.setAttribute("zen-tree-id", node.id);
      }
      const parent = this.getParent(node);
      if (parent) {
        node.setAttribute(
          "zen-tree-parent-id",
          parent.getAttribute("zen-tree-id") || parent.id || ""
        );
      } else {
        node.removeAttribute("zen-tree-parent-id");
      }
      this.#updateTwisty(node);
      const childHidden = hidden || !!node._zenTreeCollapsed;
      for (const child of this.getChildren(node)) {
        apply(child, level + 1, childHidden);
      }
    };
    apply(root, this.getLevel(root), this.#isHiddenByCollapse(root));
  }

  #applyIndent(node, level) {
    node.style.setProperty(
      "--zen-folder-indent",
      `${level * this.#indentStep}px`
    );
  }

  nestTab(node, parent, { position = "end" } = {}) {
    if (
      node === parent ||
      !this.isTreeEligible(node) ||
      !this.isTreeEligible(parent) ||
      this.#isAncestor(node, parent) || // prevent cycles
      this.#workspaceIdOf(node) !== this.#workspaceIdOf(parent)
    ) {
      return false;
    }

    const previousParent = this.getParent(node);
    const subtree = [node, ...this.getDescendants(node)]; // already DFS order
    node._zenTreeParent = parent;

    let reference;
    if (position === "start") {
      reference = parent;
    } else {
      const existing = this.getChildren(parent).filter(c => c !== node);
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
    this.#onTreeChanged(node);
    return true;
  }

  promoteSubtree(node) {
    const grandparent = this.getParent(this.getParent(node));
    if (grandparent) {
      this.nestTab(node, grandparent, { position: "end" });
    } else {
      this.detachTab(node);
    }
  }

  detachTab(node) {
    if (!this.getParent(node)) {
      return;
    }
    node._zenTreeParent = null;
    this.reindex(node);
    this.#onTreeChanged(node);
  }

  nestTabsAsChildren(nodes, parent) {
    const eligible = nodes.filter(
      n =>
        n !== parent && this.isTreeEligible(n) && !this.#isAncestor(n, parent)
    );
    for (const n of eligible) {
      this.nestTab(n, parent, { position: "end" });
    }
  }

  // Flatten overflow: a node beyond max-depth is re-parented to the nearest
  // ancestor at (max-depth - 1), collapsing overflow at the cap boundary.
  clampDepth(root) {
    const max = this.#maxDepth;
    if (max <= 0) {
      return;
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

  // The "roots" of a dragged set: dragged nodes whose parent is NOT also in the
  // set. Their subtrees travel with them and keep their internal hierarchy.
  #draggedRoots(draggedTabs) {
    const nodes = [];
    const seen = new Set();
    for (const tab of draggedTabs) {
      const node = this.#nodeOf(tab);
      if (this.isTreeEligible(node) && !seen.has(node)) {
        seen.add(node);
        nodes.push(node);
      }
    }
    const set = new Set(nodes);
    return domOrderOf(nodes.filter(n => !set.has(this.getParent(n))));
  }

  // NEST drop: a single dragged root nests under target keeping its hierarchy;
  // multiple roots each become a direct child of target (subtrees follow).
  handleNestDrop(draggedTabs, target) {
    target = this.#nodeOf(target);
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

  // The valid level range for inserting just below `prev` and above `next`: at
  // most prev's child, and no shallower than next (else next is orphaned).
  reorderLevelRange(prev, next) {
    const prevLevel = prev ? this.getLevel(prev) : 0;
    const maxLevel = prev ? prevLevel + 1 : 0;
    const minLevel = Math.min(next ? this.getLevel(next) : 0, maxLevel);
    return { minLevel, maxLevel, prevLevel };
  }

  // REORDER drop driven by the indicator: apply the exact anchor (`prev`) and
  // level it resolved, so the drop always lands where the preview showed.
  handleReorderDropAt(draggedTabs, prev, level) {
    if (!this.enabled) {
      return;
    }
    const roots = this.#draggedRoots(draggedTabs);
    if (roots.length) {
      this.#applyReorder(roots, this.#parentForLevel(prev, level ?? 0));
    }
  }

  // REORDER drop with no indicator (e.g. programmatic): derive the anchor from
  // the post-move neighbors and drop the roots as siblings of the node above.
  handleReorderDrop(draggedTabs, targetLevel = null) {
    if (!this.enabled) {
      return;
    }
    const roots = this.#draggedRoots(draggedTabs);
    if (!roots.length) {
      return;
    }
    const draggedNodes = new Set(
      roots.flatMap(r => [r, ...this.getDescendants(r)])
    );
    let prev = roots[0].previousElementSibling;
    while (prev && (!this.isTreeEligible(prev) || draggedNodes.has(prev))) {
      prev = prev.previousElementSibling;
    }
    let next = this.#lastSubtreeNode(roots[roots.length - 1]).nextElementSibling;
    while (next && (!this.isTreeEligible(next) || draggedNodes.has(next))) {
      next = next.nextElementSibling;
    }
    const { minLevel, maxLevel, prevLevel } = this.reorderLevelRange(prev, next);
    let level = targetLevel == null ? prevLevel : targetLevel;
    level = Math.max(minLevel, Math.min(level, maxLevel));
    this.#applyReorder(roots, this.#parentForLevel(prev, level));
  }

  #applyReorder(roots, newParent) {
    const affected = new Set();
    for (const root of roots) {
      const oldParent = this.getParent(root);
      if (
        newParent === root ||
        this.#isAncestor(root, newParent) ||
        oldParent === newParent
      ) {
        affected.add(this.#rootOf(root));
        continue;
      }
      root._zenTreeParent = newParent;
      affected.add(this.#rootOf(root));
      // Refresh the former parent too, so it loses its twisty if this was its
      // last child.
      if (oldParent) {
        affected.add(this.#rootOf(oldParent));
      }
    }
    for (const r of affected) {
      this.reindex(r);
      this.#enforceDomOrder(r);
    }
    this.#onTreeChanged(roots[0]);
  }

  setCollapsed(node, collapsed) {
    if (!this.getChildren(node).length) {
      return;
    }
    node._zenTreeCollapsed = collapsed;
    node.toggleAttribute("zen-tree-collapsed", collapsed);

    const descendants = this.getDescendants(node);
    for (const d of descendants) {
      // A descendant is hidden if ANY ancestor up to `node` is collapsed.
      d.toggleAttribute("zen-tree-hidden", this.#isHiddenByCollapse(d));
    }

    const selectedNode = this.#nodeOf(gBrowser.selectedTab);
    if (collapsed && selectedNode && descendants.includes(selectedNode)) {
      gBrowser.selectedTab = this.#representativeTab(node); // nearest visible
    }

    this.#updateTwisty(node);
    this.#onTreeChanged(node);
  }

  toggleCollapse(node) {
    this.setCollapsed(node, !node._zenTreeCollapsed);
  }

  #isHiddenByCollapse(node) {
    let current = this.getParent(node);
    while (current) {
      if (current._zenTreeCollapsed) {
        return true;
      }
      current = this.getParent(current);
    }
    return false;
  }

  // Clickable twisty on parent nodes only. On a tab it overlays the favicon in
  // the icon stack; on a split group it floats at the group's inline-start edge.
  #updateTwisty(node) {
    const hasChildren = this.getChildren(node).length > 0;
    const isGroup = this.#isSplitGroup(node);
    let twisty = isGroup
      ? node.querySelector(":scope > .zen-tree-twisty")
      : node.querySelector(".tab-icon-stack > .zen-tree-twisty");
    if (hasChildren && !twisty) {
      twisty = document.createXULElement("image");
      twisty.className = "zen-tree-twisty";
      twisty.addEventListener("mousedown", e => {
        e.stopPropagation();
        e.preventDefault();
        this.toggleCollapse(node);
      });
      if (isGroup) {
        twisty.classList.add("zen-tree-twisty-group");
        // The group overrides appendChild to route children into its tab
        // container (which feeds `.tabs`); bypass it so the twisty is a real
        // direct child and isn't mistaken for a tab.
        Node.prototype.appendChild.call(node, twisty);
      } else {
        const iconStack = node.querySelector(".tab-icon-stack");
        const favicon = iconStack?.querySelector(".tab-icon-image");
        if (favicon) {
          favicon.after(twisty);
        } else {
          (iconStack || node).appendChild(twisty);
        }
      }
    } else if (!hasChildren && twisty) {
      twisty.remove();
    }
    node.toggleAttribute("zen-tree-parent", hasChildren);
  }

  #isAncestor(maybeAncestor, node) {
    let current = this.getParent(node);
    while (current) {
      if (current === maybeAncestor) {
        return true;
      }
      current = this.getParent(current);
    }
    return false;
  }

  #rootOf(node) {
    let current = node;
    while (this.getParent(current)) {
      current = this.getParent(current);
    }
    return current;
  }

  #lastSubtreeNode(node) {
    const desc = this.getDescendants(node);
    return desc.length ? desc[desc.length - 1] : node;
  }

  #ancestorAtLevel(node, level) {
    let current = node;
    while (current && this.getLevel(current) > level) {
      current = this.getParent(current);
    }
    return current;
  }

  // Parent that puts a node at `level` when dropped just below `prev`: level 0 is
  // the root, the deepest allowed (prev's level + 1) makes it prev's child, and
  // values between climb prev's ancestor chain. Clamped to that valid range.
  #parentForLevel(prev, level) {
    if (!prev || level <= 0) {
      return null;
    }
    const max = this.getLevel(prev) + 1;
    return this.#ancestorAtLevel(prev, Math.min(level, max) - 1);
  }

  // Re-assert DFS DOM order from parent pointers, so a node the native drag
  // misplaced sits right after its DFS predecessor.
  #enforceDomOrder(root) {
    const dfs = [];
    const visit = node => {
      dfs.push(node);
      for (const child of this.getChildren(node)) {
        visit(child);
      }
    };
    visit(root);
    this._suppressMoveHandling = true;
    for (let i = 1; i < dfs.length; i++) {
      if (dfs[i].previousElementSibling !== dfs[i - 1]) {
        dfs[i - 1].after(dfs[i]);
      }
    }
    gBrowser.tabContainer._invalidateCachedTabs();
    this._suppressMoveHandling = false;
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

  // After a plain reorder, set node's parent to that of its previous visible
  // sibling (or root at container start).
  #reparentFromNeighbor(node) {
    if (!this.isTreeEligible(node)) {
      return;
    }
    let prev = node.previousElementSibling;
    while (prev && !this.isTreeEligible(prev)) {
      prev = prev.previousElementSibling;
    }
    const newParent = prev ? this.getParent(prev) : null;
    if (newParent === node || this.#isAncestor(node, newParent)) {
      return; // never create a cycle
    }
    const oldParent = this.getParent(node);
    if (oldParent !== newParent) {
      node._zenTreeParent = newParent;
      this.reindex(this.#rootOf(node));
      if (oldParent) {
        this.reindex(this.#rootOf(oldParent));
      }
      this.#onTreeChanged(node);
    }
  }

  // Fire a change so window-sync can replicate the new tree state.
  #onTreeChanged(node) {
    if (node && node.isConnected) {
      node.dispatchEvent(new CustomEvent("ZenTreeChanged", { bubbles: true }));
    }
  }

  // Drop a node out of the tree, promoting its children to its former parent and
  // clearing its own tree state/attributes.
  #clearNodeState(node) {
    node._zenTreeParent = null;
    node._zenTreeCollapsed = false;
    node.removeAttribute?.("zen-tree-parent-id");
    node.removeAttribute?.("zen-tree-collapsed");
    node.removeAttribute?.("zen-tree-hidden");
    node.style?.removeProperty("--zen-folder-indent");
    this.#updateTwisty(node);
  }

  #evictFromTree(node) {
    const children = this.getChildren(node);
    const newParent = this.getParent(node);
    for (const child of children) {
      child._zenTreeParent = newParent;
    }
    this.#clearNodeState(node);

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
    this.#onTreeChanged(node);
  }

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
    const opener = tab.owner ? this.#nodeOf(tab.owner) : null;
    if (
      !opener ||
      !this.isTreeEligible(tab) ||
      !this.isTreeEligible(opener) ||
      this.#workspaceIdOf(tab) !== this.#workspaceIdOf(opener)
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
    // A split-view member closing isn't the group node closing; leave its
    // tree-children alone (on_TabUngrouped handles a fully dissolved split).
    if (tab.group?.hasAttribute("split-view-group")) {
      return;
    }
    const node = this.#nodeOf(tab);
    const children = this.getChildren(node);
    if (!children.length) {
      // A leaf is closing: once it's gone, refresh its parent so the parent
      // drops its twisty if this was its last child.
      const parent = this.getParent(node);
      if (parent) {
        window.setTimeout(() => {
          if (parent.isConnected) {
            this.reindex(this.#rootOf(parent));
          }
        }, 0);
      }
      return;
    }
    const behavior = Services.prefs.getStringPref(
      "zen.tab-tree.close-parent-behavior",
      "promote"
    );
    if (behavior === "close-subtree") {
      const subtree = this.getDescendants(node).flatMap(n =>
        this.#isSplitGroup(n) ? [...n.tabs] : [n]
      );
      // Defer so the current close finishes first.
      window.setTimeout(() => {
        gBrowser.removeTabs(
          subtree.filter(t => t.isConnected && !t.closing),
          { animate: true }
        );
      }, 0);
      return;
    }
    // Promote only surviving children, to the nearest non-closing ancestor.
    // Co-closing members keep their parent-id so undo-close can rebuild the
    // branch instead of restoring it flat.
    const survivingParent = this.#nearestSurvivingParent(node);
    const survivors = children.filter(child => !this.#isClosing(child));
    for (const child of survivors) {
      child._zenTreeParent = survivingParent;
    }
    const roots = new Set();
    if (survivingParent) {
      roots.add(this.#rootOf(survivingParent));
    } else {
      for (const child of survivors) {
        roots.add(child);
      }
    }
    for (const root of roots) {
      this.reindex(root);
    }
    this.#onTreeChanged(node);
  }

  // Mid-removal, or tagged for a multiselection close batch (before any
  // TabClose fires) — lets us tell co-closing members from survivors.
  #isClosing(node) {
    return !!(node?.closing || node?._closedInMultiselection);
  }

  #nearestSurvivingParent(node) {
    let parent = this.getParent(node);
    while (parent && this.#isClosing(parent)) {
      parent = this.getParent(parent);
    }
    return parent || null;
  }

  on_TabPinned(event) {
    if (this.enabled) {
      this.#evictFromTree(event.target);
    }
  }

  // A tab joining a split view hands its tree role to the split group node: the
  // group inherits the tab's parent, adopts its children, and the tab is cleared.
  on_TabGrouped(event) {
    const tab = event.detail;
    const group = event.target;
    if (!this.enabled || !this.#isSplitGroup(group)) {
      return;
    }
    const tabParent = this.getParent(tab);
    if (
      tabParent &&
      !this.getParent(group) &&
      group !== tabParent &&
      !this.#isAncestor(group, tabParent)
    ) {
      group._zenTreeParent = tabParent;
    }
    for (const child of this.#childrenByPointer(tab)) {
      if (child !== group && !this.#isAncestor(child, group)) {
        child._zenTreeParent = group;
      }
    }
    this.#clearNodeState(tab);
    this.reindex(this.#rootOf(group));
    // The split element was just inserted at the original tab's spot; once the DOM
    // settles, re-assert DFS order so adopted children sit below the group, not
    // above it.
    window.setTimeout(() => {
      if (group.isConnected) {
        this.reindex(this.#rootOf(group));
        this.#enforceDomOrder(this.#rootOf(group));
        this.#onTreeChanged(group);
      }
    }, 0);
    this.#onTreeChanged(group);
  }

  // A split shrinking below two tabs is no longer a node: promote its children
  // to its parent and clear it. Deferred so the DOM settles first.
  on_TabUngrouped(event) {
    const group = event.target;
    if (!this.enabled || !this.#isSplitGroup(group)) {
      return;
    }
    window.setTimeout(() => this.#reconcileDissolvedSplit(group), 0);
  }

  #reconcileDissolvedSplit(group) {
    const stillSplit =
      group?.isConnected &&
      this.#isSplitGroup(group) &&
      (group.tabs || []).filter(t => t.isConnected).length >= 2;
    if (stillSplit) {
      return;
    }
    const groupParent = this.getParent(group);
    const children = this.#childrenByPointer(group);
    for (const child of children) {
      child._zenTreeParent = groupParent;
    }
    this.#clearNodeState(group);
    const root = groupParent ? this.#rootOf(groupParent) : children[0];
    if (root) {
      this.reindex(root);
      this.#enforceDomOrder(root);
      this.#onTreeChanged(root);
    }
  }

  on_TabMove(event) {
    // During a user drag the drop handler owns tree fixup (handleReorderDrop /
    // handleNestDrop). Only handle programmatic moves (e.g. gBrowser.moveTabTo).
    if (!this.enabled || this._suppressMoveHandling || this._dragActive) {
      return;
    }
    const node = this.#nodeOf(event.target);
    if (!this.isTreeEligible(node)) {
      return;
    }
    // A programmatic move relocates only this node. If it has a subtree, bring
    // the whole subtree along so it stays contiguous, then re-derive the parent.
    const descendants = this.getDescendants(node);
    if (descendants.length) {
      this.#moveSubtreeAfter([node, ...descendants], node);
    }
    this.#reparentFromNeighbor(node);
  }

  on_SSWindowStateReady() {
    this.rebuildFromAttributes();
  }

  // Undo-close restores the persisted attributes but not the live pointers, so
  // rebuild to put the tab back in its branch. Coalesced so a multi-tab restore
  // only rebuilds once.
  on_SSTabRestored() {
    if (!this.enabled || this.#rebuildScheduled) {
      return;
    }
    this.#rebuildScheduled = true;
    window.setTimeout(() => {
      this.#rebuildScheduled = false;
      this.rebuildFromAttributes();
    }, 0);
  }

  // Reconnect _zenTreeParent pointers from persisted zen-tree-parent-id.
  rebuildFromAttributes() {
    if (!this.enabled) {
      return;
    }
    // Index by both the live id and the persisted zen-tree-id, so a parent
    // resolves even after window-sync reassigned its id on restore.
    const byId = new Map();
    for (const node of this.#nodes()) {
      const treeId = node.getAttribute("zen-tree-id");
      if (treeId) {
        byId.set(treeId, node);
      }
      if (node.id) {
        byId.set(node.id, node);
      }
    }
    for (const node of this.#nodes()) {
      const pid = node.getAttribute("zen-tree-parent-id");
      const parent = pid ? byId.get(pid) : null;
      node._zenTreeParent =
        parent && parent !== node && this.isTreeEligible(node) ? parent : null;
      node._zenTreeCollapsed = node.hasAttribute("zen-tree-collapsed");
    }
    for (const node of this.#nodes()) {
      if (!this.isTreeEligible(node) || this.getParent(node)) {
        continue;
      }
      // Parent not present yet (mid incremental restore): leave it pending —
      // reindexing here would strip the parent-id a later rebuild needs.
      if (node.getAttribute("zen-tree-parent-id")) {
        continue;
      }
      this.reindex(node);
      // A restored subtree can land out of order (a child reinserted at its old
      // index); re-assert DFS order so the branch isn't split by other tabs.
      if (this.getChildren(node).length) {
        this.#enforceDomOrder(node);
      }
    }
    for (const node of this.#nodes()) {
      if (node._zenTreeCollapsed) {
        for (const d of this.getDescendants(node)) {
          d.toggleAttribute("zen-tree-hidden", this.#isHiddenByCollapse(d));
        }
      }
    }
  }
}

window.gZenTabTree = new nsZenTabTree();
