/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { h, ICONS } from "./dom.mjs";

/**
 * Asks for the Primary Password. Used for the lock screen and, with a
 * different title, for the "confirm it is you" step before a sensitive action.
 *
 * @param {object} options
 * @param {{ unlock(password: string): object }} options.session
 * @param {Function} options.onUnlocked
 * @param {string} [options.titleL10n]
 * @param {string} [options.descriptionL10n]
 * @param {string} [options.lockReason]  Why the vault locked on its own.
 * @param {Function} [options.onCancel]  Adds a cancel button when given.
 * @returns {HTMLElement}
 */
export function createLockScreen({
  session,
  onUnlocked,
  titleL10n = "peppermint-vault-locked-title",
  descriptionL10n = "peppermint-vault-locked-description",
  lockReason = null,
  onCancel = null,
}) {
  const error = h("p", {
    class: "vault-form-error",
    attrs: { role: "alert", hidden: true },
  });
  const input = h("input", {
    attrs: {
      type: "password",
      id: "vault-unlock-password",
      autocomplete: "off",
      spellcheck: "false",
      required: true,
    },
  });
  const submit = h("button", {
    class: "vault-button vault-primary",
    attrs: { type: "submit" },
    l10n: "peppermint-vault-unlock",
  });
  let countdown = null;
  let pendingBlock = null;

  function showError(l10n, args) {
    document.l10n.setAttributes(error, l10n, args);
    error.hidden = false;
  }

  function stopCountdown() {
    clearTimeout(pendingBlock);
    pendingBlock = null;
    if (countdown) {
      clearInterval(countdown);
      countdown = null;
    }
    input.disabled = false;
    submit.disabled = false;
  }

  function blockFor(retryAfterMs) {
    stopCountdown();
    input.disabled = true;
    submit.disabled = true;
    const until = Date.now() + retryAfterMs;
    const tick = () => {
      const seconds = Math.ceil((until - Date.now()) / 1000);
      if (seconds <= 0) {
        stopCountdown();
        error.hidden = true;
        input.focus();
        return;
      }
      showError("peppermint-vault-error-wait", { seconds });
    };
    tick();
    countdown = setInterval(tick, 500);
  }

  const form = h(
    "form",
    {
      class: "vault-card vault-lock",
      attrs: { novalidate: true },
      on: {
        submit(event) {
          event.preventDefault();
          const password = input.value;
          input.value = "";
          if (!password) {
            showError("peppermint-vault-error-empty");
            return;
          }
          const result = session.unlock(password);
          if (result.ok) {
            stopCountdown();
            onUnlocked();
          } else if (result.noPassword) {
            showError("peppermint-vault-error-no-password");
          } else if (result.retryAfterMs) {
            if (result.blocked) {
              blockFor(result.retryAfterMs);
            } else {
              showError("peppermint-vault-error-wrong-password");
              pendingBlock = setTimeout(
                () => blockFor(result.retryAfterMs),
                1200
              );
            }
          }
        },
      },
    },
    h("img", {
      class: "vault-hero-icon",
      attrs: { src: ICONS.vault, alt: "" },
    }),
    h("h1", { class: "vault-card-title", l10n: titleL10n }),
    h("p", { class: "vault-muted", l10n: descriptionL10n }),
    lockReason
      ? h("p", {
          class: "vault-notice",
          l10n: `peppermint-vault-lock-reason-${lockReason}`,
        })
      : null,
    h(
      "label",
      { class: "vault-field", attrs: { for: "vault-unlock-password" } },
      h("span", { l10n: "peppermint-vault-primary-password" }),
      input
    ),
    error,
    h(
      "div",
      { class: "vault-actions" },
      onCancel
        ? h("button", {
            class: "vault-button",
            attrs: { type: "button" },
            l10n: "peppermint-vault-cancel",
            on: { click: onCancel },
          })
        : null,
      submit
    )
  );

  const initialRetry = session.retryAfterMs;
  if (initialRetry) {
    blockFor(initialRetry);
  }
  queueMicrotask(() => input.focus());
  return form;
}
