// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { nsZenDOMOperatedFeature } from "chrome://browser/content/zen-components/ZenCommonUtils.mjs";

// Middle-mouse drag-select gesture on the vertical tab strip:
//   middle-drag        -> select the contiguous range from anchor to cursor
//   release            -> close the selected range
//   right-click (held) -> abort the close, open the tab context menu on the
//                         selection; the trailing release is then a no-op
//   clean middle-click -> close just that tab (native behavior, replicated)
class nsZenTabMultiSelectDrag extends nsZenDOMOperatedFeature {
  #enabled = false;
  #strip = null;
  // null | { anchor, startX, startY, dragging, aborted, additive }
  #state = null;
  static #THRESHOLD = 4; // px of movement before a click becomes a drag

  init() {
    this.#enabled = Services.prefs.getBoolPref(
      "zen.tabs.middle-drag-select.enabled",
      true
    );
    if (!this.#enabled) {
      return;
    }
    this.#strip = document.getElementById("tabbrowser-tabs");
    if (!this.#strip) {
      return;
    }
    // Capture phase so we run before the native middle-click-close handler.
    this.#strip.addEventListener("mousedown", this, true);
  }

  get enabled() {
    return this.#enabled;
  }

  handleEvent(event) {
    switch (event.type) {
      case "mousedown":
        this.#onMouseDown(event);
        break;
      case "mousemove":
        this.#onMouseMove(event);
        break;
      case "mouseup":
        this.#onMouseUp(event);
        break;
      case "click":
      case "auxclick":
        // Swallow the click that follows our owned middle press so the native
        // middle-click-close can't double-fire, then stop swallowing.
        if (event.button === 1) {
          event.preventDefault();
          event.stopPropagation();
        }
        this.#removeClickSwallowers();
        break;
      case "contextmenu":
        this.#onContextMenu(event);
        break;
      case "keydown":
        if (event.key === "Escape") {
          this.#cancel();
        }
        break;
    }
  }

  #tabFrom(event) {
    return event.target?.closest?.(".tabbrowser-tab") || null;
  }

  #tabUnderPoint(x, y) {
    const el = document.elementFromPoint(x, y);
    return el?.closest?.(".tabbrowser-tab") || null;
  }

  #onMouseDown(event) {
    if (event.button !== 1) {
      return; // middle button only
    }
    const tab = this.#tabFrom(event);
    if (!tab) {
      return; // let native "open tab on empty strip space" behavior run
    }
    // Own the middle button on tabs: suppress autoscroll + native handling.
    event.preventDefault();
    event.stopPropagation();

    this.#state = {
      anchor: tab,
      startX: event.screenX,
      startY: event.screenY,
      dragging: false,
      aborted: false,
      additive: event.getModifierState("Accel"),
    };
    window.addEventListener("mousemove", this, true);
    window.addEventListener("mouseup", this, true);
    window.addEventListener("contextmenu", this, true);
    window.addEventListener("keydown", this, true);
    window.addEventListener("click", this, true);
    window.addEventListener("auxclick", this, true);
  }

  #onMouseMove(event) {
    const s = this.#state;
    if (!s || s.aborted) {
      return;
    }
    if (!s.dragging) {
      const moved =
        Math.abs(event.screenX - s.startX) +
        Math.abs(event.screenY - s.startY);
      if (moved < nsZenTabMultiSelectDrag.#THRESHOLD) {
        return;
      }
      s.dragging = true;
    }
    const over =
      event.target?.closest?.(".tabbrowser-tab") ||
      this.#tabUnderPoint(event.clientX, event.clientY);
    if (!over) {
      return;
    }
    // Rebuild the range from the anchor each move so shrinking deselects.
    if (!s.additive) {
      gBrowser.clearMultiSelectedTabs();
    }
    gBrowser.addToMultiSelectedTabs(s.anchor);
    if (over !== s.anchor) {
      gBrowser.addRangeToMultiSelectedTabs(s.anchor, over);
    }
    this.#markPendingClose();
  }

  #markPendingClose() {
    for (const tab of gBrowser.tabs) {
      tab.toggleAttribute(
        "zen-pending-close",
        !this.#state?.aborted && tab.multiselected
      );
    }
  }

  #clearPendingClose() {
    for (const tab of gBrowser.tabs) {
      tab.removeAttribute("zen-pending-close");
    }
  }

  #onMouseUp(event) {
    if (event.button !== 1) {
      return;
    }
    const s = this.#state;
    if (!s) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();

    if (s.aborted) {
      // Right-click already opened the menu; the release does nothing.
      this.#cancel();
      return;
    }

    if (!s.dragging) {
      // Clean middle-click: replicate the native single-tab close.
      const tab = s.anchor;
      this.#cancel();
      if (tab?.isConnected) {
        if (tab.multiselected) {
          gBrowser.removeMultiSelectedTabs();
        } else {
          gBrowser.removeTab(tab, { animate: true });
        }
      }
      return;
    }

    // Drag release: close the whole selection.
    const toClose = gBrowser.selectedTabs.filter(
      t => t.isConnected && !t.closing
    );
    this.#cancel();
    if (toClose.length) {
      gBrowser.removeTabs(toClose, { animate: true });
    }
  }

  #onContextMenu(event) {
    const s = this.#state;
    if (!s || !s.dragging) {
      return;
    }
    // Abort the close and let the native tab context menu open on the current
    // multiselection. The trailing middle release becomes a no-op.
    s.aborted = true;
    this.#clearPendingClose();
  }

  #removeClickSwallowers() {
    window.removeEventListener("click", this, true);
    window.removeEventListener("auxclick", this, true);
  }

  #cancel() {
    this.#clearPendingClose();
    window.removeEventListener("mousemove", this, true);
    window.removeEventListener("mouseup", this, true);
    window.removeEventListener("contextmenu", this, true);
    window.removeEventListener("keydown", this, true);
    this.#state = null;
    // Keep the click swallowers until the trailing click fires (next tick).
    window.setTimeout(() => this.#removeClickSwallowers(), 0);
  }
}

window.gZenTabMultiSelectDrag = new nsZenTabMultiSelectDrag();
