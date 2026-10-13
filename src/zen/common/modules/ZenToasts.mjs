// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

const DEFAULT_TOAST_TIMEOUT_MS = 2000;

/**
 * Shows short-lived toast messages in the window's toast container.
 */
export class nsZenToastManager {
  /** @type {Map<string, number>} Auto-hide timer per message id. */
  #timeouts = new Map();
  #container = null;

  get #toastContainer() {
    if (!this.#container) {
      this.#container = document.getElementById("zen-toast-container");
    }
    return this.#container;
  }

  /**
   * @param {string} messageId - Fluent id of the toast label.
   * @param {object} [options]
   * @param {object} [options.l10nArgs] - Fluent args for the label.
   * @param {string} [options.descriptionId] - Fluent id of a second line.
   * @param {number} [options.timeout] - Auto-hide delay in milliseconds.
   * @param {{id: string, command: Function}} [options.button] - Action button.
   */
  async show(messageId, options = {}) {
    // A pending auto-hide for this message must not fire while the toast is
    // being (re)animated below, or it would remove the element mid-animation.
    this.#clearTimer(messageId);
    const [toast, reused] = this.#createToastElement(messageId, options);
    const container = this.#toastContainer;
    container.removeAttribute("hidden");
    container.appendChild(toast);

    const timeout = options.timeout || DEFAULT_TOAST_TIMEOUT_MS;
    const hide = () => {
      this.#timeouts.delete(messageId);
      if (
        !toast.isConnected ||
        Services.prefs.getBoolPref("ui.popup.disable_autohide")
      ) {
        return;
      }
      gZenUIManager.motion
        .animate(
          toast,
          { opacity: [1, 0], scale: [1, 0.5] },
          { duration: 0.2, bounce: 0 }
        )
        .then(() => {
          toast.remove();
          if (!container.children.length) {
            container.setAttribute("hidden", true);
          }
        });
    };

    if (reused) {
      await gZenUIManager.motion.animate(
        toast,
        { scale: 0.2 },
        { duration: 0.1, bounce: 0 }
      );
    } else {
      toast.addEventListener("mouseover", () => this.#clearTimer(messageId));
      toast.addEventListener("mouseout", () =>
        this.#scheduleHide(messageId, hide, timeout)
      );
    }

    if (!toast.style.transform) {
      toast.style.transform = "scale(0)";
    }
    await gZenUIManager.motion.animate(
      toast,
      { scale: 1 },
      { type: "spring", bounce: 0.2, duration: 0.5 }
    );
    this.#scheduleHide(messageId, hide, timeout);
  }

  #clearTimer(messageId) {
    const timer = this.#timeouts.get(messageId);
    if (timer) {
      clearTimeout(timer);
      this.#timeouts.delete(messageId);
    }
  }

  #scheduleHide(messageId, hide, timeout) {
    this.#clearTimer(messageId);
    this.#timeouts.set(messageId, setTimeout(hide, timeout));
  }

  /**
   * @param {string} messageId - Fluent id of the toast label.
   * @param {object} options - Options passed to show().
   * @returns {[Element, boolean]} The toast element and whether it was an
   *   already visible toast for the same message.
   */
  #createToastElement(messageId, options) {
    const createButton = () => {
      const button = document.createXULElement("button");
      button.id = options.button.id;
      button.classList.add("footer-button", "primary");
      button.addEventListener("command", options.button.command);
      return button;
    };

    for (const child of this.#toastContainer.children) {
      if (child._messageId !== messageId) {
        continue;
      }
      child.removeAttribute("button");
      if (options.button) {
        child.querySelector("button")?.remove();
        child.appendChild(createButton());
        child.setAttribute("button", true);
      }
      return [child, true];
    }

    const wrapper = document.createXULElement("hbox");
    const element = document.createXULElement("vbox");
    const label = document.createXULElement("label");
    document.l10n.setAttributes(label, messageId, options.l10nArgs);
    element.appendChild(label);
    if (options.descriptionId) {
      const description = document.createXULElement("label");
      description.classList.add("description");
      document.l10n.setAttributes(description, options.descriptionId, options);
      element.appendChild(description);
    }
    wrapper.appendChild(element);
    if (options.button) {
      wrapper.appendChild(createButton());
      wrapper.setAttribute("button", true);
    }
    wrapper.classList.add("zen-toast");
    wrapper._messageId = messageId;
    return [wrapper, false];
  }
}
