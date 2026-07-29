// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

/**
 * Secondary Back / Forward / Reload access in the sidebar icon rail.
 *
 * Expanded: compact grouped buttons near #zen-sidebar-top-buttons.
 * Collapsed / height-constrained: single Navigation button → menupopup
 * using the same native Firefox commands (no reimplemented disabled logic).
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

function ensureMounted(win) {
  const doc = win.document;
  if (doc.getElementById("astra-sidebar-navigation")) {
    bind(win);
    return;
  }

  const target =
    doc.getElementById("zen-sidebar-top-buttons-customization-target") ||
    doc.getElementById("zen-sidebar-top-buttons");
  if (!target || !win.MozXULElement) {
    win.setTimeout(() => ensureMounted(win), 250);
    return;
  }

  let frag;
  try {
    frag = win.MozXULElement.parseXULToFragment(`
      <toolbaritem id="astra-sidebar-navigation"
                   class="chromeclass-toolbar-additional astra-sidebar-navigation"
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

function isExpanded(win) {
  const root = win.document.documentElement;
  const toolbox = win.document.getElementById("navigator-toolbox");
  return (
    root.getAttribute("zen-sidebar-expanded") === "true" ||
    toolbox?.getAttribute("zen-sidebar-expanded") === "true"
  );
}

function isHeightConstrained(win) {
  const host = win.document.getElementById("astra-sidebar-navigation");
  const group = win.document.getElementById("astra-sidebar-nav-group");
  const target = win.document.getElementById(
    "zen-sidebar-top-buttons-customization-target"
  );
  if (!host || !group || !target) {
    return false;
  }
  // Horizontal squeeze only — the top strip is always ~toolbar-height tall,
  // so never use height. If the 3-button group cannot fit beside App Hub /
  // Suraksha without overflowing the customization target, use the menu.
  const groupW = group.getBoundingClientRect().width || 90;
  const targetW = target.getBoundingClientRect().width;
  const hostW = host.getBoundingClientRect().width;
  return targetW > 0 && targetW < groupW + 72;
}

function updateMode(win) {
  const host = win.document.getElementById("astra-sidebar-navigation");
  if (!host) {
    return;
  }
  const useMenu = !isExpanded(win) || isHeightConstrained(win);
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
    attributeFilter: ["zen-sidebar-expanded", "zen-compact-mode"],
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
