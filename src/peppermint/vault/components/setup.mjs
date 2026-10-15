/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { h, ICONS } from "./dom.mjs";

const STRENGTH_L10N = [
  "peppermint-vault-strength-none",
  "peppermint-vault-strength-weak",
  "peppermint-vault-strength-fair",
  "peppermint-vault-strength-good",
  "peppermint-vault-strength-strong",
];

/**
 * The steps to turn Vault on, or to set a Primary Password again after it was
 * removed. The recovery warning has to be acknowledged before anything is
 * changed.
 *
 * @param {object} options
 * @param {"enable"|"restore"} options.mode
 * @param {object} options.password   PeppermintVaultPassword
 * @param {object} options.vault      PeppermintVault
 * @param {object} options.session    PeppermintVaultSession
 * @param {Function} options.onDone
 * @returns {HTMLElement}
 */
export function createSetup({ mode, password, vault, session, onDone }) {
  const hasPassword = password.hasPassword;
  const error = h("p", {
    class: "vault-form-error",
    attrs: { role: "alert", hidden: true },
  });
  const showError = (l10n, args) => {
    document.l10n.setAttributes(error, l10n, args);
    error.hidden = false;
  };

  const attrs = {
    autocomplete: "off",
    spellcheck: "false",
    autocapitalize: "off",
  };
  const current = h("input", {
    attrs: { ...attrs, type: "password", id: "vault-setup-current" },
  });
  const first = h("input", {
    attrs: { ...attrs, type: "password", id: "vault-setup-new" },
  });
  const second = h("input", {
    attrs: { ...attrs, type: "password", id: "vault-setup-confirm" },
  });
  const meter = h("meter", {
    class: "vault-meter",
    attrs: { min: 0, max: 4, value: 0 },
  });
  const meterLabel = h("span", {
    class: "vault-muted",
    l10n: STRENGTH_L10N[0],
    attrs: { "aria-live": "polite" },
  });
  const acknowledge = h("input", {
    attrs: { type: "checkbox", id: "vault-setup-ack" },
  });
  const submit = h("button", {
    class: "vault-button vault-primary",
    attrs: { type: "submit" },
    l10n:
      mode == "restore"
        ? "peppermint-vault-setup-restore"
        : "peppermint-vault-setup-turn-on",
  });

  first.addEventListener("input", () => {
    const strength = password.strength(first.value);
    meter.value = strength;
    document.l10n.setAttributes(meterLabel, STRENGTH_L10N[strength]);
  });

  const field = (id, l10n, input) =>
    h(
      "label",
      { class: "vault-field", attrs: { for: id } },
      h("span", { l10n }),
      input
    );

  async function run() {
    error.hidden = true;
    if (!acknowledge.checked) {
      showError("peppermint-vault-error-acknowledge");
      return;
    }
    let chosen;
    if (hasPassword) {
      chosen = current.value;
      if (!chosen || !password.verify(chosen)) {
        showError("peppermint-vault-error-wrong-password");
        return;
      }
    } else {
      chosen = first.value;
      const check = password.validateNew(chosen);
      if (!check.ok) {
        showError(
          check.reason == "empty"
            ? "peppermint-vault-error-empty"
            : "peppermint-vault-error-too-short",
          { min: 8 }
        );
        return;
      }
      if (chosen !== second.value) {
        showError("peppermint-vault-error-mismatch");
        return;
      }
      try {
        await password.change("", chosen);
      } catch {
        showError("peppermint-vault-error-set-failed");
        return;
      }
    }

    const short = [...chosen].length < 8;
    if (mode == "enable") {
      vault.completeSetup();
    }
    session.unlock(chosen);
    for (const input of [current, first, second]) {
      input.value = "";
    }
    onDone({ shortPassword: short });
  }

  const canSet = hasPassword || password.canSet;
  const form = h(
    "form",
    {
      class: "vault-card vault-setup",
      attrs: { novalidate: true },
      on: {
        submit(event) {
          event.preventDefault();
          run();
        },
      },
    },
    h("img", {
      class: "vault-hero-icon",
      attrs: { src: ICONS.vault, alt: "" },
    }),
    h("h1", {
      class: "vault-card-title",
      l10n:
        mode == "restore"
          ? "peppermint-vault-needs-password-title"
          : "peppermint-vault-setup-title",
    }),
    h("p", {
      class: "vault-muted",
      l10n:
        mode == "restore"
          ? "peppermint-vault-needs-password-description"
          : "peppermint-vault-setup-description",
    }),
    h(
      "div",
      { class: "vault-warning", attrs: { role: "note" } },
      h("img", { class: "vault-icon", attrs: { src: ICONS.warning, alt: "" } }),
      h("p", { l10n: "peppermint-vault-recovery-warning" })
    ),
    canSet
      ? null
      : h("p", {
          class: "vault-form-error",
          l10n: "peppermint-vault-error-policy",
        }),
    hasPassword
      ? field(
          "vault-setup-current",
          "peppermint-vault-primary-password",
          current
        )
      : [
          field("vault-setup-new", "peppermint-vault-new-password", first),
          h("div", { class: "vault-strength" }, meter, meterLabel),
          field(
            "vault-setup-confirm",
            "peppermint-vault-confirm-password",
            second
          ),
        ],
    h(
      "label",
      { class: "vault-check", attrs: { for: "vault-setup-ack" } },
      acknowledge,
      h("span", { l10n: "peppermint-vault-acknowledge" })
    ),
    error,
    h("div", { class: "vault-actions" }, submit)
  );
  if (!canSet) {
    submit.disabled = true;
  }
  return form;
}
