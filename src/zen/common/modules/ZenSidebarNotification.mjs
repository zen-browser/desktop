/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { html } from 'chrome://global/content/vendor/lit.all.mjs';
import { MozLitElement } from 'chrome://global/content/lit-utils.mjs';

const lazy = {};

ChromeUtils.defineLazyGetter(lazy, 'siblingElement', () => {
  // All our notifications should be attached after the media controls toolbar
  return document.getElementById('zen-media-controls-toolbar');
});

/**
 * Zen Sidebar Notification Component
 *
 * Displays and takes care of animations for notifications that
 * appear in the sidebar.
 *
 * @properties {headingL10nId} - The L10n ID for the heading text.
 */
class ZenSidebarNotification extends MozLitElement {
  static properties = {
    headingL10nId: { type: String, fluent: true },
  };

  constructor() {
    super();
  }

  connectedCallback() {
    super.connectedCallback();
    if (this.parentElement) {
      this.#animateIn();
    }
  }

  remove() {
    this.#animateOut().then(() => {
      super.remove();
    });
  }

  render() {
    return html`
      <link
        rel="stylesheet"
        href="chrome://browser/content/zen-styles/zen-sidebar-notification.css" />
      <hbox class="zen-sidebar-notification-header">
        <label
          class="zen-sidebar-notification-heading"
          data-l10n-id="${this.headingL10nId}"></label>
      </hbox>
    `;
  }

  #animateIn() {
    return gZenUIManager.motion.animate(
      this.mediaControlBar,
      {
        opacity: [0, 1],
        y: [10, 0],
      },
      {}
    );
  }

  #animateOut() {
    return gZenUIManager.motion.animate(
      this,
      {
        opacity: [1, 0],
        y: [0, 10],
      },
      {
        duration: 0.1,
      }
    );
  }
}

export default function createSidebarNotification({ headingL10nId }) {
  const notification = new ZenSidebarNotification();
  notification.setAttribute('heading-l10n-id', headingL10nId);

  lazy.siblingElement.insertAdjacentElement('afterend', notification);
  return notification;
}

customElements.define('zen-sidebar-notification', ZenSidebarNotification);
