/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * India Services panel icons.
 *
 * Same local-only pipeline as App Hub / Search Hub:
 *   packaged chrome SVG → Places cached data URI → monogram
 *
 * Never assigns http(s) list-style-image or fetches remote favicons.
 */

import { ASTRA_APP_HUB_CATALOG } from "chrome://browser/content/zen-components/AstraAppHubCatalog.mjs";
import {
  isPackagedIconUrl,
  monogramForName,
  resolveAppIcon,
  resolvePlacesFaviconURL,
} from "chrome://browser/content/zen-components/AstraAppHubIcons.mjs";

const catalogById = new Map(
  (ASTRA_APP_HUB_CATALOG.apps || []).map(app => [app.id, app])
);

const catalogByHost = new Map();
for (const app of ASTRA_APP_HUB_CATALOG.apps || []) {
  const host = String(app.hostname || "")
    .replace(/^www\./, "")
    .toLowerCase();
  if (host) {
    catalogByHost.set(host, app);
  }
}

function hostFromUrl(url) {
  try {
    return Services.io.newURI(url).asciiHost.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

function catalogAppForButton(button) {
  const id = button.getAttribute("data-app-id");
  if (id && catalogById.has(id)) {
    return catalogById.get(id);
  }
  const host = hostFromUrl(button.getAttribute("data-url") || "");
  return (host && catalogByHost.get(host)) || null;
}

function shortcutFromButton(button) {
  const catalog = catalogAppForButton(button);
  const url = button.getAttribute("data-url") || catalog?.url || "";
  const name =
    button.querySelector(".zen-app-launcher-item-label")?.value ||
    catalog?.name ||
    "App";
  return {
    id: catalog?.id || button.getAttribute("data-app-id") || hostFromUrl(url) || "india",
    name,
    url,
    iconKey: catalog?.iconKey || catalog?.id || button.getAttribute("data-icon-key") || "",
    monogram: catalog?.monogram || monogramForName(name),
  };
}

function isSafeIconSrc(src) {
  return isPackagedIconUrl(src);
}

function ensureIconStack(button, iconInfo) {
  button.removeAttribute("style");
  button.style.listStyleImage = "none";

  const stale = button.querySelector(":scope > image.zen-app-launcher-item-icon");
  if (stale) {
    stale.remove();
  }

  let stack = button.querySelector(".zen-app-launcher-item-icon-stack");
  if (!stack) {
    stack = button.ownerDocument.createXULElement("stack");
    stack.classList.add(
      "zen-app-launcher-item-icon-stack",
      "astra-app-hub-item-icon-stack"
    );
    stack.setAttribute("aria-hidden", "true");
    const label = button.querySelector(".zen-app-launcher-item-label");
    button.insertBefore(stack, label || button.firstChild);
  }

  let mono = stack.querySelector(".astra-app-hub-item-monogram");
  if (!mono) {
    mono = button.ownerDocument.createXULElement("label");
    mono.classList.add(
      "zen-app-launcher-item-monogram",
      "astra-app-hub-item-monogram"
    );
    stack.insertBefore(mono, stack.firstChild);
  }
  mono.setAttribute("value", iconInfo.monogram || iconInfo.text || "?");
  mono.setAttribute("data-accent", String(iconInfo.accent ?? 0));
  return stack;
}

function appendSafeIcon(stack, src) {
  if (!isSafeIconSrc(src)) {
    return;
  }
  stack.querySelectorAll("img.zen-app-launcher-item-icon").forEach(el => el.remove());
  const image = stack.ownerDocument.createElementNS(
    "http://www.w3.org/1999/xhtml",
    "img"
  );
  image.classList.add("zen-app-launcher-item-icon", "astra-app-hub-item-icon");
  image.setAttribute("alt", "");
  image.setAttribute("draggable", "false");
  image.setAttribute("aria-hidden", "true");
  image.addEventListener(
    "load",
    () => {
      if (stack.isConnected) {
        stack.setAttribute("data-icon-loaded", "true");
        stack.removeAttribute("data-icon-error");
      }
    },
    { once: true }
  );
  image.addEventListener(
    "error",
    () => {
      if (stack.isConnected) {
        stack.setAttribute("data-icon-error", "true");
        stack.removeAttribute("data-icon-loaded");
        image.removeAttribute("src");
      }
    },
    { once: true }
  );
  image.src = src;
  stack.appendChild(image);
}

async function resolveLocalIcon(shortcut) {
  const packaged = resolveAppIcon({
    id: shortcut.id,
    name: shortcut.name,
    url: shortcut.url,
    iconKey: shortcut.iconKey,
    monogram: shortcut.monogram,
  });
  if (packaged.type === "image" && isSafeIconSrc(packaged.src)) {
    return packaged;
  }
  try {
    const places = await resolvePlacesFaviconURL(shortcut.url, {
      privateBrowsing: false,
    });
    if (places && isSafeIconSrc(places)) {
      return {
        type: "image",
        src: places,
        monogram: packaged.monogram,
        accent: packaged.accent,
        iconSource: "places",
      };
    }
  } catch {
    // Places miss is expected for never-visited services.
  }
  return packaged;
}

export async function paintIndiaServiceIcons(panel) {
  if (!panel) {
    return;
  }
  const buttons = panel.querySelectorAll(".zen-app-launcher-item[data-url]");
  await Promise.all(
    [...buttons].map(async button => {
      const shortcut = shortcutFromButton(button);
      const iconInfo = await resolveLocalIcon(shortcut);
      const stack = ensureIconStack(button, iconInfo);
      if (iconInfo.type === "image" && isSafeIconSrc(iconInfo.src)) {
        appendSafeIcon(stack, iconInfo.src);
      }
    })
  );
}

export function indiaPanelHasRemoteIcons(panel) {
  if (!panel) {
    return false;
  }
  for (const el of panel.querySelectorAll(".zen-app-launcher-item")) {
    const style = el.getAttribute("style") || "";
    const list = el.style?.listStyleImage || "";
    const blob = `${style} ${list}`;
    if (/https?:/i.test(blob) || /google\.com\/s2\/favicons/i.test(blob)) {
      return true;
    }
  }
  return false;
}
