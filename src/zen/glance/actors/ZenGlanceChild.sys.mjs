// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.
export class ZenGlanceChild extends JSWindowActorChild {
  #activationMethod;

  constructor() {
    super();
    this.clickListener = this.handleClick.bind(this);
  }

  async handleEvent(event) {
    switch (event.type) {
      case 'DOMContentLoaded':
        await this.initiateGlance();
        break;
      case 'keydown':
        this.onKeyDown(event);
        break;
      default:
    }
  }

  async #initActivationMethod() {
    this.#activationMethod = await this.sendQuery('ZenGlance:GetActivationMethod');
  }

  async initiateGlance() {
    this.mouseIsDown = false;
    await this.#initActivationMethod();
    this.contentWindow.document.addEventListener('click', this.clickListener, { capture: true });
  }

  ensureOnlyKeyModifiers(event) {
    return !(event.ctrlKey ^ event.altKey ^ event.shiftKey ^ event.metaKey);
  }

  openGlance(target, originalTarget) {
    let url = target.href;
    // Add domain to relative URLs
    if (!url.match(/^(?:[a-z]+:)?\/\//i)) {
      url = this.contentWindow.location.origin + url;
    }
    // Get the largest element we can get. If the `A` element
    // is a parent of the original target, use the anchor element,
    // otherwise use the original target.
    let rect = originalTarget.getBoundingClientRect();
    const anchorRect = target.getBoundingClientRect();
    if (anchorRect.width * anchorRect.height > rect.width * rect.height) {
      rect = anchorRect;
    }
    this.sendAsyncMessage('ZenGlance:OpenGlance', {
      url,
      clientX: rect.left,
      clientY: rect.top,
      width: rect.width,
      height: rect.height,
    });
  }

  handleClick(event) {
    if (this.ensureOnlyKeyModifiers(event) || event.button !== 0 || event.defaultPrevented) {
      return;
    }
    const activationMethod = this.#activationMethod;
    if (activationMethod === 'ctrl' && !event.ctrlKey) {
      return;
    } else if (activationMethod === 'alt' && !event.altKey) {
      return;
    } else if (activationMethod === 'shift' && !event.shiftKey) {
      return;
    } else if (activationMethod === 'meta' && !event.metaKey) {
      return;
    }
    // get closest A element
    const target = event.target.closest('A');
    if (target) {
      event.preventDefault();
      event.stopPropagation();

      this.openGlance(target, event.originalTarget || event.target);
    }
  }

  onKeyDown(event) {
    if (event.defaultPrevented || event.key !== 'Escape') {
      return;
    }
    this.sendAsyncMessage('ZenGlance:CloseGlance', {
      hasFocused: this.contentWindow.document.activeElement !== this.contentWindow.document.body,
    });
  }
}
