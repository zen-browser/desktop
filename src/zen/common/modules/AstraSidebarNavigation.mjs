// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

/**
 * Secondary Back / Forward / Reload access in the sidebar icon rail.
 *
 * Sidebar+Top Toolbar (expanded): 3-button group near #zen-sidebar-top-buttons
 *   (additive — native top-toolbar controls stay).
 * Only Sidebar: single Navigation menu (strip is too narrow for the group).
 * Collapsed: hidden via CSS so native toolbar Back/Forward stay the only set.
 */

const gInited = new WeakSet();

export function installAstraSidebarNavigation(win = window) {
  if (gInited.has(win)) {
    return;
  }
  gInited.add(win);
  win.gAstraSidebarNavigation = { update: () => updateMode(win) };
  ensureMounted(win);
}

function sidebarTarget(doc) {
  return (
    doc.getElementById("zen-sidebar-top-buttons-customization-target") ||
    doc.getElementById("zen-sidebar-top-buttons")
  );
}

function ensureMounted(win) {
  const doc = win.document;
  const existing = doc.getElementById("astra-sidebar-navigation");
  if (existing) {
    pinToSidebarStrip(win, existing);
    bind(win);
    return;
  }

  const target = sidebarTarget(doc);
  if (!target || !win.MozXULElement) {
    win.setTimeout(() => ensureMounted(win), 250);
    return;
  }

  let frag;
  try {
    // Intentionally NOT chromeclass-toolbar-additional: ZenUIManager's
    // leave-single-toolbar path sweeps that class into #nav-bar, which left
    // empty Back/Forward shells on the top toolbar (Bug 2) after layout flips.
    frag = win.MozXULElement.parseXULToFragment(`
      <toolbaritem id="astra-sidebar-navigation"
                   class="astra-sidebar-navigation"
                   removable="false"
                   overflows="false"
                   skipintoolbarset="true">
        <hbox id="astra-sidebar-nav-group" class="astra-sidebar-nav-group">
          <toolbarbutton id="astra-sidebar-back"
                         class="toolbarbutton-1 astra-sidebar-nav-btn"
                         command="Browser:BackOrBackDuplicate"
                         tooltiptext="Back"/>
          <toolbarbutton id="astra-sidebar-forward"
                         class="toolbarbutton-1 astra-sidebar-nav-btn"
                         command="Browser:ForwardOrForwardDuplicate"
                         tooltiptext="Forward"/>
          <toolbarbutton id="astra-sidebar-reload"
                         class="toolbarbutton-1 astra-sidebar-nav-btn"
                         command="Browser:ReloadOrDuplicate"
                         tooltiptext="Reload"/>
        </hbox>
        <toolbarbutton id="astra-sidebar-nav-menu"
                       class="toolbarbutton-1 astra-sidebar-nav-menu"
                       tooltiptext="Navigation"
                       type="menu">
          <menupopup id="astra-sidebar-nav-popup">
            <menuitem command="Browser:BackOrBackDuplicate" label="Back"/>
            <menuitem command="Browser:ForwardOrForwardDuplicate" label="Forward"/>
            <menuitem command="Browser:ReloadOrDuplicate" label="Reload"/>
          </menupopup>
        </toolbarbutton>
      </toolbaritem>
    `);
  } catch (error) {
    console.warn("[AstraSidebarNavigation] parseXUL failed", error);
    return;
  }

  const separator = doc.getElementById("zen-sidebar-top-buttons-separator");
  if (separator && separator.parentNode === target) {
    target.insertBefore(frag, separator);
  } else {
    target.appendChild(frag);
  }
  bind(win);
}

function pinToSidebarStrip(win, host) {
  const target = sidebarTarget(win.document);
  if (!target || !host || host.parentNode === target) {
    return;
  }
  const separator = win.document.getElementById(
    "zen-sidebar-top-buttons-separator"
  );
  if (separator && separator.parentNode === target) {
    target.insertBefore(host, separator);
  } else {
    target.appendChild(host);
  }
}

function isExpanded(win) {
  const root = win.document.documentElement;
  const toolbox = win.document.getElementById("navigator-toolbox");
  return (
    root.getAttribute("zen-sidebar-expanded") === "true" ||
    toolbox?.getAttribute("zen-sidebar-expanded") === "true"
  );
}

function isSingleToolbar(win) {
  return win.document.documentElement.getAttribute("zen-single-toolbar") === "true";
}

function updateMode(win) {
  const host = win.document.getElementById("astra-sidebar-navigation");
  if (!host) {
    return;
  }
  pinToSidebarStrip(win, host);

  // Collapsed: CSS hides the host. Only Sidebar: compact Navigation menu.
  // Sidebar+Top expanded: 3-button group.
  const useMenu = isExpanded(win) && isSingleToolbar(win);
  if (useMenu) {
    host.setAttribute("astra-nav-compact", "true");
  } else {
    host.removeAttribute("astra-nav-compact");
  }
}

function bind(win) {
  const doc = win.document;
  const host = doc.getElementById("astra-sidebar-navigation");
  if (!host) {
    return;
  }
  const update = () => updateMode(win);
  update();

  const toolbox = doc.getElementById("navigator-toolbox");
  if (toolbox) {
    new win.MutationObserver(update).observe(toolbox, {
      attributes: true,
      attributeFilter: ["zen-sidebar-expanded", "width", "style"],
    });
  }
  new win.MutationObserver(update).observe(doc.documentElement, {
    attributes: true,
    attributeFilter: [
      "zen-sidebar-expanded",
      "zen-compact-mode",
      "zen-single-toolbar",
    ],
  });

  if (typeof win.ResizeObserver === "function") {
    const ro = new win.ResizeObserver(update);
    const topButtons = doc.getElementById("zen-sidebar-top-buttons");
    if (topButtons) {
      ro.observe(topButtons);
    }
    ro.observe(host);
  }
  win.addEventListener("resize", update, { passive: true });
}
