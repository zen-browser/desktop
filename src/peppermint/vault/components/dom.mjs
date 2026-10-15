/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Safe DOM building for the Vault page. The page is privileged, so values are
 * only ever assigned as text or attributes, never parsed as markup.
 */

export const ICONS = {
  eye: "chrome://global/skin/icons/eye.svg",
  eyeSlash: "chrome://global/skin/icons/eye-slash.svg",
  copy: "chrome://global/skin/icons/edit-copy.svg",
  edit: "chrome://global/skin/icons/edit.svg",
  delete: "chrome://global/skin/icons/delete.svg",
  plus: "chrome://global/skin/icons/plus.svg",
  search: "chrome://global/skin/icons/search-glass.svg",
  warning: "chrome://global/skin/icons/warning.svg",
  check: "chrome://global/skin/icons/check.svg",
  close: "chrome://global/skin/icons/close.svg",
  link: "chrome://global/skin/icons/link.svg",
  vault: "chrome://browser/skin/zen-icons/passwords.svg",
};

/**
 * @param {string} tag
 * @param {object} [props]
 * @param {string} [props.class]
 * @param {object} [props.attrs]    Plain attributes.
 * @param {string} [props.l10n]     Fluent id for the element text/attributes.
 * @param {object} [props.l10nArgs] Arguments for the Fluent message.
 * @param {string} [props.text]     Literal text (data, never markup).
 * @param {object} [props.on]       Event listeners by event name.
 * @param {...(Node|string|null|false)} children
 * @returns {HTMLElement}
 */
export function h(tag, props = {}, ...children) {
  const element = document.createElement(tag);
  if (props.class) {
    element.className = props.class;
  }
  for (const [attribute, value] of Object.entries(props.attrs ?? {})) {
    if (value !== null && value !== undefined && value !== false) {
      element.setAttribute(attribute, value === true ? "" : String(value));
    }
  }
  if (props.l10n) {
    document.l10n.setAttributes(element, props.l10n, props.l10nArgs);
  }
  if (props.text !== undefined) {
    element.textContent = props.text;
  }
  for (const [event, handler] of Object.entries(props.on ?? {})) {
    element.addEventListener(event, handler);
  }
  for (const child of children.flat()) {
    if (child) {
      element.append(child);
    }
  }
  return element;
}

/**
 * A button that shows only an icon. The accessible name comes from Fluent
 * attributes (.aria-label and .title).
 *
 * @param {string} icon
 * @param {string} l10n
 * @param {object} [l10nArgs]
 * @param {object} [extra]
 * @returns {HTMLButtonElement}
 */
export function iconButton(icon, l10n, l10nArgs, extra = {}) {
  const button = h("button", {
    class: `vault-icon-button ${extra.class ?? ""}`.trim(),
    attrs: { type: "button", ...extra.attrs },
    l10n,
    l10nArgs,
    on: extra.on,
  });
  button.append(
    h("img", { class: "vault-icon", attrs: { src: icon, alt: "" } })
  );
  return button;
}

export function clear(element) {
  element.replaceChildren();
}

/**
 * The first letter of a title, for the letter tile.
 *
 * @param {string} title
 * @returns {string}
 */
export function initialOf(title) {
  return ([...title.trim()][0] ?? "?").toUpperCase();
}
