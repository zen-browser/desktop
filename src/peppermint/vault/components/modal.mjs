/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { h, iconButton, ICONS } from "./dom.mjs";

const CONFIRM_RESET_MS = 3000;

let activeDialog = null;

/** Closes the open modal, if any, and drops every value it held. */
export function closeModal() {
  if (!activeDialog) {
    return;
  }
  const dialog = activeDialog;
  activeDialog = null;
  for (const input of dialog.querySelectorAll("input")) {
    input.value = "";
  }
  dialog.close();
  dialog.remove();
}

function buildField(field, state) {
  const id = `vault-modal-${field.id}`;
  const input = h("input", {
    attrs: {
      id,
      type: field.kind == "secret" ? "password" : "text",
      autocomplete: "off",
      autocapitalize: "off",
      spellcheck: "false",
      required: field.required,
      inputmode: field.kind == "origin" ? "url" : null,
    },
  });
  input.value = field.value ?? "";
  state.inputs.set(field.id, input);

  const row = [input];
  if (field.kind == "secret") {
    const toggle = iconButton(
      ICONS.eye,
      "peppermint-vault-show-password",
      undefined,
      { attrs: { "aria-pressed": "false" } }
    );
    toggle.addEventListener("click", () => {
      const show = input.type == "password";
      input.type = show ? "text" : "password";
      toggle.setAttribute("aria-pressed", String(show));
      toggle.querySelector("img").src = show ? ICONS.eyeSlash : ICONS.eye;
      document.l10n.setAttributes(
        toggle,
        show
          ? "peppermint-vault-hide-password"
          : "peppermint-vault-show-password"
      );
    });
    row.push(toggle);
  }
  return h(
    "label",
    { class: "vault-field", attrs: { for: id } },
    h("span", { l10n: field.labelL10nId }),
    h("span", { class: "vault-input-row" }, row)
  );
}

/**
 * Opens the edit or create modal.
 *
 * @param {object} options
 * @param {string} options.titleL10n
 * @param {string} options.submitL10n
 * @param {Array<{id: string, kind: string, labelL10nId: string, value?: string, required?: boolean}>} options.fields
 * @param {(values: object) => Promise<void>} options.onSubmit
 *        Throws an error with a .code the page can translate.
 * @param {() => Promise<void>} [options.onDelete]
 * @param {(error: Error) => string} options.errorL10n  Maps an error to a Fluent id.
 * @param {Element} [options.returnFocusTo]
 */
export function openModal({
  titleL10n,
  submitL10n,
  fields,
  onSubmit,
  onDelete = null,
  errorL10n,
  returnFocusTo = null,
}) {
  closeModal();
  const state = { inputs: new Map() };
  const error = h("p", {
    class: "vault-form-error",
    attrs: { role: "alert", hidden: true },
  });

  const showError = e => {
    document.l10n.setAttributes(error, errorL10n(e));
    error.hidden = false;
  };

  let deleteTimer = null;
  const deleteButton = onDelete
    ? h("button", {
        class: "vault-button vault-danger",
        attrs: { type: "button" },
        l10n: "peppermint-vault-delete",
        on: {
          async click() {
            if (!deleteTimer) {
              document.l10n.setAttributes(
                deleteButton,
                "peppermint-vault-delete-confirm"
              );
              deleteTimer = setTimeout(() => {
                deleteTimer = null;
                document.l10n.setAttributes(
                  deleteButton,
                  "peppermint-vault-delete"
                );
              }, CONFIRM_RESET_MS);
              return;
            }
            clearTimeout(deleteTimer);
            try {
              await onDelete();
              closeModal();
              returnFocusTo?.focus();
            } catch (e) {
              showError(e);
            }
          },
        },
      })
    : null;

  const form = h(
    "form",
    {
      attrs: { method: "dialog", novalidate: true },
      on: {
        async submit(event) {
          event.preventDefault();
          error.hidden = true;
          const values = {};
          for (const [id, input] of state.inputs) {
            values[id] = input.value;
          }
          try {
            await onSubmit(values);
            closeModal();
            returnFocusTo?.focus();
          } catch (e) {
            showError(e);
          }
        },
      },
    },
    h("h2", { class: "vault-card-title", l10n: titleL10n }),
    fields.map(field => buildField(field, state)),
    error,
    h(
      "div",
      { class: "vault-actions" },
      deleteButton,
      h("span", { class: "vault-spacer" }),
      h("button", {
        class: "vault-button",
        attrs: { type: "button" },
        l10n: "peppermint-vault-cancel",
        on: {
          click() {
            closeModal();
            returnFocusTo?.focus();
          },
        },
      }),
      h("button", {
        class: "vault-button vault-primary",
        attrs: { type: "submit" },
        l10n: submitL10n,
      })
    )
  );

  const dialog = h("dialog", { class: "vault-modal" }, form);
  dialog.addEventListener("cancel", event => {
    event.preventDefault();
    closeModal();
    returnFocusTo?.focus();
  });
  document.body.append(dialog);
  activeDialog = dialog;
  dialog.showModal();
  state.inputs.values().next().value?.focus();
}
