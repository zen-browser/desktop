// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import {
  CMP_RULES,
  CONSENT_FRAME_HOSTS,
  VENDORS,
} from "resource:///modules/zen/cookieconsent/ZenCookieConsentVendors.sys.mjs";

const HANDLED_ATTR = "data-zen-cookie-handled";
const MANAGE_ATTR = "data-zen-cookie-manage";
const STEP_ATTR = "data-zen-cookie-step";
const MAX_CANDIDATES = 12;
const MAX_WALK = 400;
const MAX_DEPTH = 8;
const MAX_TEXT = 2000;
const MAX_BUTTONS = 20;

const DIALOG_SELECTOR = "[role='dialog'], [role='alertdialog'], [aria-modal='true']";

const GENERIC_SELECTOR = [
  "[id*='cookie-banner' i]",
  "[class*='cookie-banner' i]",
  "[id*='cookie-consent' i]",
  "[class*='cookie-consent' i]",
  "[id*='cookie-notice' i]",
  "[class*='cookie-notice' i]",
  "[id*='cookieconsent' i]",
  "[class*='cookieconsent' i]",
  "[id*='cookie-popup' i]",
  "[class*='cookie-popup' i]",
  "[id*='consent-banner' i]",
  "[class*='consent-banner' i]",
  "[id*='consent-modal' i]",
  "[class*='consent-modal' i]",
  "[id*='gdpr-banner' i]",
  "[class*='gdpr-banner' i]",
  "[id*='gdpr-consent' i]",
  "[class*='gdpr-consent' i]",
  "[id*='privacy-banner' i]",
  "[class*='privacy-banner' i]",
].join(", ");

const KNOWN_ROOT_SELECTOR = VENDORS.map(vendor => vendor.root).join(", ");


/**
 * @param {string} hostname
 * @returns {boolean}
 */
export function isConsentFrameHost(hostname) {
  const host = String(hostname || "").toLowerCase().replace(/\.$/, "");
  if (!host) {
    return false;
  }
  return CONSENT_FRAME_HOSTS.some(
    entry => host === entry || host.endsWith(`.${entry}`)
  );
}
const TOP_SELECTOR = `${KNOWN_ROOT_SELECTOR}, ${DIALOG_SELECTOR}, ${GENERIC_SELECTOR}`;

export const CONSENT_MATCH_SELECTOR = TOP_SELECTOR;
const BUTTON_SELECTOR =
  "button, [role='button'], a, input[type='button'], input[type='submit']";
const LABELED_CONTROL_SELECTOR = [
  BUTTON_SELECTOR,
  "[id*='decline' i]",
  "[id*='reject' i]",
  "[id*='deny' i]",
  "[class*='decline' i]",
  "[class*='reject' i]",
  "[class*='deny' i]",
  "[class*='refuse' i]",
].join(", ");
const SHADOW_HOST_SELECTOR = [
  "[id*='cookie' i]",
  "[id*='consent' i]",
  "[id*='gdpr' i]",
  "[id*='cmp' i]",
  "[class*='cookie' i]",
  "[class*='consent' i]",
  "[class*='gdpr' i]",
].join(", ");
const MAX_CONTROLS = 400;
const MAX_SHADOW_HOSTS = 20;

const REJECT_PHRASES = [
  "continue without accepting",
  "continue without consent",
  "necessary cookies only",
  "reject non-essential",
  "continuer sans accepter",
  "vain valttamattomat",
  "alleen noodzakelijke",
  "endast nodvandiga",
  "strictly necessary",
  "apenas essenciais",
  "apenas necessarios",
  "tylko niezbedne",
  "nur essenzielle",
  "nur notwendige",
  "kun nodvendige",
  "hylkaa kaikki",
  "odmitnout vse",
  "odrzuc wszystko",
  "rejeitar tudo",
  "alles weigeren",
  "rechazar todas",
  "rechazar todo",
  "solo necesarias",
  "rifiuta tutto",
  "solo necessari",
  "tout refuser",
  "refuser tout",
  "alles ablehnen",
  "alle ablehnen",
  "nicht einverstanden",
  "essential only",
  "only essential",
  "necessary only",
  "only necessary",
  "required only",
  "only required",
  "continue without",
  "avvisa alla",
  "afvis alle",
  "avvis alle",
  "decline all",
  "refuse all",
  "reject all",
  "deny all",
  "no thanks",
  "ablehnen",
  "odmitnout",
  "weigeren",
  "rechazar",
  "rejeitar",
  "refuser",
  "rifiuta",
  "odrzuc",
  "hylkaa",
  "disagree",
  "decline",
  "opt out",
  "avvisa",
  "reject",
  "refuse",
  "afvis",
  "avvis",
  "deny",
];

const ACCEPT_PHRASES = [
  "accept all cookies",
  "zaakceptuj wszystko",
  "alles akzeptieren",
  "alle akzeptieren",
  "alles accepteren",
  "hyvaksy kaikki",
  "prijmout vse",
  "aceitar tudo",
  "accetta tutto",
  "aceptar todo",
  "tout accepter",
  "acceptera alla",
  "accepter alle",
  "agree to all",
  "allow all",
  "accept all",
  "einverstanden",
  "akzeptieren",
  "zustimmen",
  "j accepte",
  "jaccepte",
  "accepteren",
  "zaakceptuj",
  "acceptera",
  "prijmout",
  "hyvaksy",
  "i accept",
  "i agree",
  "aceitar",
  "accetta",
  "aceptar",
  "accepter",
  "got it",
  "allow",
  "agree",
  "accept",
];

const MANAGE_PHRASES = [
  "manage preferences",
  "cookie settings",
  "manage options",
  "more choices",
  "more options",
  "einstellungen",
  "installningar",
  "indstillinger",
  "preferencias",
  "instellingen",
  "ustawienia",
  "nastaveni",
  "asetukset",
  "preferenze",
  "parametres",
  "configurar",
  "preferences",
  "preference",
  "customise",
  "customize",
  "settings",
  "options",
  "manage",
];

const CONSENT_WORDS = [
  "cookie",
  "cookies",
  "consent",
  "gdpr",
  "privacy",
  "privacidade",
  "tracking",
  "einwilligung",
  "datenschutz",
  "consentement",
  "confidentialite",
  "consentimiento",
  "privacidad",
  "consenso",
  "toestemming",
  "consentimento",
  "ciasteczka",
  "zgoda",
  "samtycke",
  "kakor",
  "samtykke",
  "evaste",
  "suostumus",
  "souhlas",
];

function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['’]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isWordChar(char) {
  return !!char && /[\p{L}\p{N}]/u.test(char);
}

function includesPhrase(text, phrase) {
  let from = 0;
  while (from <= text.length) {
    const index = text.indexOf(phrase, from);
    if (index === -1) {
      return false;
    }
    const before = index === 0 ? "" : text[index - 1];
    const after = text[index + phrase.length] || "";
    if (!isWordChar(before) && !isWordChar(after)) {
      return true;
    }
    from = index + phrase.length;
  }
  return false;
}

function bestPhrase(text, phrases) {
  let best = 0;
  for (const phrase of phrases) {
    if (phrase.length > best && includesPhrase(text, phrase)) {
      best = phrase.length;
    }
  }
  return best;
}

export function scoreLabel(text) {
  const name = normalize(text).slice(0, 180);
  return {
    reject: bestPhrase(name, REJECT_PHRASES),
    accept: bestPhrase(name, ACCEPT_PHRASES),
    manage: bestPhrase(name, MANAGE_PHRASES),
  };
}

function matchesSelector(element, selector) {
  try {
    return element.matches?.(selector);
  } catch {
    return false;
  }
}

function vendorFor(element) {
  for (const vendor of VENDORS) {
    if (matchesSelector(element, vendor.root)) {
      return vendor;
    }
  }
  return null;
}

function isDialog(element) {
  const role = element.getAttribute?.("role");
  return (
    role === "dialog" ||
    role === "alertdialog" ||
    element.getAttribute?.("aria-modal") === "true"
  );
}

function positionOf(element) {
  const inline = element.getAttribute?.("style") || "";
  if (/position\s*:\s*fixed/i.test(inline) || /position\s*:\s*sticky/i.test(inline)) {
    return "fixed";
  }
  const view = element.ownerDocument?.defaultView;
  if (!view?.getComputedStyle) {
    return "";
  }
  try {
    return view.getComputedStyle(element).position || "";
  } catch {
    return "";
  }
}

function isOverlay(element) {
  const position = positionOf(element);
  return position === "fixed" || position === "sticky";
}

function shadowRootOf(node) {
  if (!node || node.nodeType !== 1) {
    return null;
  }
  try {
    if (node.openOrClosedShadowRoot) {
      return node.openOrClosedShadowRoot;
    }
  } catch {
    // The binding is only available to privileged callers.
  }
  return node.shadowRoot || null;
}

function walk(node, depth, state, visit) {
  if (!node || depth > MAX_DEPTH || state.seen > MAX_WALK) {
    return;
  }
  state.seen++;
  visit(node);
  const shadow = shadowRootOf(node);
  if (shadow) {
    walk(shadow, depth + 1, state, visit);
  }
  const children = node.childNodes;
  if (!children) {
    return;
  }
  for (const child of children) {
    walk(child, depth + 1, state, visit);
  }
}

function queryDeep(root, selector) {
  let found = null;
  walk(root, 0, { seen: 0 }, node => {
    if (found || !node.matches) {
      return;
    }
    if (matchesSelector(node, selector)) {
      found = node;
    }
  });
  return found;
}

function hasPassword(root) {
  return !!queryDeep(root, "input[type='password']");
}

function accessibleName(element) {
  const doc = element.ownerDocument;
  const labelledby = element.getAttribute?.("aria-labelledby");
  if (labelledby && doc) {
    const parts = [];
    for (const id of labelledby.split(/\s+/)) {
      const node = doc.getElementById(id);
      if (node?.textContent) {
        parts.push(node.textContent);
      }
    }
    if (parts.length) {
      return parts.join(" ");
    }
  }
  return (
    element.getAttribute?.("aria-label") ||
    element.getAttribute?.("title") ||
    (element.localName === "input" ? element.getAttribute?.("value") : "") ||
    element.textContent ||
    ""
  );
}

function isClickable(element) {
  if (!element || element.disabled) {
    return false;
  }
  const tag = element.localName;
  if (tag === "button" || tag === "a") {
    return true;
  }
  if (tag === "input") {
    const type = (element.getAttribute("type") || "").toLowerCase();
    return type === "button" || type === "submit";
  }
  if (element.getAttribute("role") === "button") {
    return true;
  }
  return matchesSelector(element, LABELED_CONTROL_SELECTOR);
}

function classToken(element) {
  const className = element?.className;
  const text = typeof className === "string" ? className : "";
  return `${element?.id || ""} ${text}`.toLowerCase();
}

function parentAcrossShadow(node) {
  if (!node) {
    return null;
  }
  if (node.parentElement) {
    return node.parentElement;
  }
  const root = node.getRootNode?.();
  return root?.host || null;
}

function textOf(root) {
  let text = "";
  walk(root, 0, { seen: 0 }, node => {
    if (text.length >= MAX_TEXT || node.nodeType !== 3) {
      return;
    }
    text += `${node.nodeValue || ""} `;
  });
  return normalize(text).slice(0, MAX_TEXT);
}

function hasConsentLanguage(text) {
  return CONSENT_WORDS.some(word => includesPhrase(text, word));
}

function buttonsIn(root) {
  const buttons = [];
  walk(root, 0, { seen: 0 }, node => {
    if (buttons.length >= MAX_BUTTONS || !node.matches) {
      return;
    }
    if (matchesSelector(node, BUTTON_SELECTOR) && isClickable(node)) {
      buttons.push(node);
    }
  });
  return buttons;
}

function rank(element) {
  if (vendorFor(element)) {
    return 3;
  }
  if (isDialog(element)) {
    return 2;
  }
  return 1;
}

function hasInlineFixed(element) {
  const inline = element.getAttribute?.("style") || "";
  return /position\s*:\s*(fixed|sticky)/i.test(inline);
}

function collectCandidates(doc, topFrame) {
  const selector = topFrame ? TOP_SELECTOR : KNOWN_ROOT_SELECTOR;
  let nodes = [];
  try {
    nodes = [...doc.querySelectorAll(selector)];
  } catch {
    return [];
  }
  const strong = [];
  const inlineFixed = [];
  const needsStyle = [];
  const seen = new Set();
  for (const node of nodes) {
    if (node.nodeType !== 1 || seen.has(node)) {
      continue;
    }
    seen.add(node);
    if (node.localName === "html" || node.localName === "body") {
      continue;
    }
    if (node.getAttribute(HANDLED_ATTR) === "hidden") {
      continue;
    }
    const vendor = vendorFor(node);
    if (!topFrame && !vendor) {
      continue;
    }
    if (vendor || isDialog(node)) {
      strong.push(node);
      continue;
    }
    if (hasInlineFixed(node)) {
      inlineFixed.push(node);
    } else {
      needsStyle.push(node);
    }
  }
  const picked = strong.slice(0, MAX_CANDIDATES);
  for (const node of inlineFixed) {
    if (picked.length >= MAX_CANDIDATES) {
      break;
    }
    picked.push(node);
  }
  let styled = 0;
  for (const node of needsStyle) {
    if (picked.length >= MAX_CANDIDATES || styled >= MAX_CANDIDATES) {
      break;
    }
    styled++;
    if (isOverlay(node)) {
      picked.push(node);
    }
  }
  picked.sort((a, b) => rank(b) - rank(a));
  return picked;
}

function ruleDecision(element, vendor) {
  const steps = CMP_RULES[vendor.id];
  if (!steps) {
    return null;
  }
  const stored = Number(element.getAttribute(STEP_ATTR) || 0);
  let index = Number.isFinite(stored) && stored > 0 ? stored : 0;
  while (index < steps.length) {
    const step = steps[index];
    const control = queryDeep(element, step.click);
    if (control && isClickable(control)) {
      return {
        action: "click",
        root: element,
        control,
        step: index + 1,
        final: !!step.final,
      };
    }
    if (step.optional) {
      index++;
      continue;
    }
    // A step already taken: wait for the next control instead of guessing.
    return stored > 0 ? { pending: true } : null;
  }
  return null;
}

function decide(element) {
  if (hasPassword(element)) {
    return null;
  }
  if (element.getAttribute(HANDLED_ATTR) === "clicked") {
    return { action: "hide", root: element, rejected: true };
  }
  const vendor = vendorFor(element);
  if (vendor) {
    const ruled = ruleDecision(element, vendor);
    if (ruled?.pending) {
      return null;
    }
    if (ruled) {
      return ruled;
    }
    const reject = queryDeep(element, vendor.reject);
    if (reject && isClickable(reject)) {
      return { action: "click", root: element, control: reject, final: true };
    }
  }
  const text = textOf(element);
  if (!vendor && !hasConsentLanguage(text)) {
    return null;
  }
  const managed = element.getAttribute(MANAGE_ATTR) === "1";
  let bestReject = null;
  let bestScore = 0;
  let hasAccept = false;
  let manage = null;
  for (const button of buttonsIn(element)) {
    const scores = scoreLabel(accessibleName(button));
    if (scores.reject > scores.accept && scores.reject > bestScore) {
      bestReject = button;
      bestScore = scores.reject;
    }
    if (scores.accept > scores.reject && scores.accept > 0) {
      hasAccept = true;
    }
    if (
      !manage &&
      !managed &&
      scores.manage > 0 &&
      scores.reject === 0 &&
      scores.accept === 0
    ) {
      manage = button;
    }
  }
  if (bestReject) {
    return { action: "click", root: element, control: bestReject, final: true };
  }
  if (manage && hasAccept) {
    return { action: "manage", root: element, control: manage };
  }
  return null;
}

function qualifiesAsBanner(node) {
  if (!node || node.localName === "body" || node.localName === "html") {
    return false;
  }
  if (hasPassword(node)) {
    return false;
  }
  const token = classToken(node);
  const vendor = !!vendorFor(node);
  const dialog = isDialog(node);
  const named = /cookie|consent|gdpr|\bcmp\b|privacy/.test(token);
  const chrome = /banner|popup|notice|modal/.test(token);
  const overlay = isOverlay(node);
  if (!vendor && !dialog && !named && !chrome && !overlay) {
    return false;
  }
  if (vendor) {
    return true;
  }
  const text = textOf(node);
  const consent = hasConsentLanguage(text) || named;
  if (!consent) {
    return false;
  }
  if (!dialog && !overlay && !named && !(chrome && text.length < 700)) {
    return false;
  }
  if (text.length > 900 && !dialog && !vendor) {
    return false;
  }
  return true;
}

function bannerRoot(control) {
  let node = parentAcrossShadow(control);
  for (let depth = 0; depth < 10 && node; depth++) {
    if (node.localName === "body" || node.localName === "html") {
      break;
    }
    if (hasPassword(node)) {
      return null;
    }
    if (node.getAttribute?.(HANDLED_ATTR) === "clicked") {
      return node;
    }
    if (qualifiesAsBanner(node)) {
      return node;
    }
    node = parentAcrossShadow(node);
  }
  return null;
}

function considerControl(control, best) {
  if (!control || control.disabled) {
    return best;
  }
  const name = accessibleName(control).slice(0, 80);
  if (name.length < 2 || name.length > 48) {
    return best;
  }
  const scores = scoreLabel(name);
  if (!(scores.reject > scores.accept && scores.reject > 0)) {
    return best;
  }
  if (!isClickable(control)) {
    return best;
  }
  const root = bannerRoot(control);
  if (!root || root === control) {
    return best;
  }
  if (root.getAttribute(HANDLED_ATTR) === "clicked") {
    return { score: 1000, action: "hide", root };
  }
  if (best && scores.reject <= best.score) {
    return best;
  }
  return { score: scores.reject, action: "click", root, control };
}

function findLabeledReject(doc) {
  const roots = [doc];
  let hosts = [];
  try {
    hosts = doc.querySelectorAll(SHADOW_HOST_SELECTOR);
  } catch {
    hosts = [];
  }
  let hostCount = 0;
  for (const host of hosts) {
    if (hostCount >= MAX_SHADOW_HOSTS) {
      break;
    }
    if (host.shadowRoot || shadowRootOf(host)) {
      hostCount++;
      roots.push(shadowRootOf(host));
    }
  }
  let best = null;
  let seen = 0;
  for (const root of roots) {
    let controls = [];
    try {
      controls = root.querySelectorAll(LABELED_CONTROL_SELECTOR);
    } catch {
      continue;
    }
    for (const control of controls) {
      if (seen >= MAX_CONTROLS) {
        break;
      }
      seen++;
      best = considerControl(control, best);
      if (best?.action === "hide") {
        return best;
      }
    }
  }
  if (!best) {
    return null;
  }
  return { action: best.action, root: best.root, control: best.control };
}

export function nodeMayContainConsent(node) {
  if (!node || node.nodeType !== 1) {
    return false;
  }
  const token = classToken(node);
  if (/cookie|consent|gdpr|cmp|onetrust|cookiebot|didomi|privacy|decline|reject|deny/.test(token)) {
    return true;
  }
  try {
    if (node.matches?.(DIALOG_SELECTOR) || node.matches?.(KNOWN_ROOT_SELECTOR)) {
      return true;
    }
  } catch {
    // Invalid selector on this node type.
  }
  if (node.matches && matchesSelector(node, BUTTON_SELECTOR)) {
    const label = (node.textContent || "").trim();
    if (label.length > 1 && label.length <= 40) {
      const scores = scoreLabel(label);
      if (scores.reject > scores.accept && scores.reject > 0) {
        return true;
      }
    }
  }
  if (node.childElementCount > 0 && node.childElementCount <= 80) {
    try {
      if (node.querySelector?.(SHADOW_HOST_SELECTOR)) {
        return true;
      }
      const buttons = node.querySelectorAll?.(BUTTON_SELECTOR);
      let seen = 0;
      for (const button of buttons || []) {
        if (seen++ >= 8) {
          break;
        }
        const label = (button.textContent || "").trim();
        if (label.length < 2 || label.length > 40) {
          continue;
        }
        const scores = scoreLabel(label);
        if (scores.reject > scores.accept && scores.reject > 0) {
          return true;
        }
      }
    } catch {
      return false;
    }
  }
  return false;
}

export function inspectConsent(doc, { topFrame = true } = {}) {
  if (!doc?.querySelectorAll) {
    return { action: "none" };
  }
  let manage = null;
  let hide = null;
  for (const candidate of collectCandidates(doc, topFrame)) {
    const decision = decide(candidate);
    if (!decision) {
      continue;
    }
    if (decision.action === "click") {
      return decision;
    }
    if (decision.action === "manage" && !manage) {
      manage = decision;
    }
    if (decision.action === "hide" && !hide) {
      hide = decision;
    }
  }
  const labeled = findLabeledReject(doc);
  if (labeled?.action === "click" || labeled?.action === "hide") {
    return labeled;
  }
  return manage || hide || { action: "none" };
}

export function markClicked(root) {
  root?.setAttribute(HANDLED_ATTR, "clicked");
}

export function markManaged(root) {
  root?.setAttribute(MANAGE_ATTR, "1");
}

function unlockScroll(doc) {
  for (const element of [doc.documentElement, doc.body]) {
    if (!element?.style) {
      continue;
    }
    const inline = element.style.overflow || element.style.overflowY;
    let hidden = inline === "hidden";
    if (!hidden) {
      const view = doc.defaultView;
      if (view?.getComputedStyle) {
        try {
          const style = view.getComputedStyle(element);
          hidden = style.overflow === "hidden" || style.overflowY === "hidden";
        } catch {
          hidden = false;
        }
      }
    }
    if (hidden) {
      element.style.setProperty("overflow", "auto", "important");
    }
  }
}

export function hideConsent(doc, root) {
  if (!doc || !root) {
    return;
  }
  root.style?.setProperty("display", "none", "important");
  root.setAttribute?.("hidden", "true");
  root.setAttribute?.(HANDLED_ATTR, "hidden");
  const parent = root.parentElement;
  if (parent) {
    for (const sibling of parent.children) {
      if (sibling === root) {
        continue;
      }
      const token = `${sibling.id || ""} ${sibling.className || ""}`.toLowerCase();
      if (!/backdrop|overlay|cookie-wall/.test(token)) {
        continue;
      }
      sibling.style?.setProperty("display", "none", "important");
    }
  }
  unlockScroll(doc);
}
