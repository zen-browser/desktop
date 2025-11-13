// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.
export class ZenGlanceChild extends JSWindowActorChild {
  #activationMethod;

  constructor() {
    super();
  }

  async handleEvent(event) {
    const handler = this[`on_${event.type}`];
    if (typeof handler === 'function') {
      await handler.call(this, event);
    }
  }

  async #initActivationMethod() {
    this.#activationMethod = await this.sendQuery('ZenGlance:GetActivationMethod');
  }

  #ensureOnlyKeyModifiers(event) {
    return !(event.ctrlKey ^ event.altKey ^ event.shiftKey ^ event.metaKey);
  }

  #openGlance(target) {
    let url = target.href;
    // Add domain to relative URLs
    if (!url.match(/^(?:[a-z]+:)?\/\//i)) {
      url = this.contentWindow.location.origin + url;
    }
    this.sendAsyncMessage('ZenGlance:OpenGlance', {
      url,
    });
  }

  #sendClickDataToParent(target, element) {
    if (!element || !target) {
      return;
    }
    // Get the largest element we can get. If the `A` element
    // is a parent of the original target, use the anchor element,
    // otherwise use the original target.
    let rect = element.getBoundingClientRect();
    const anchorRect = target.getBoundingClientRect();
    if (anchorRect.width * anchorRect.height > rect.width * rect.height) {
      rect = anchorRect;
    }
    this.sendAsyncMessage('ZenGlance:RecordLinkClickData', {
      clientX: rect.left,
      clientY: rect.top,
      width: rect.width,
      height: rect.height,
    });
  }

  on_click(event) {
    // get closest A element
    const target = event.target.closest('A');
    const elementToRecord = event.originalTarget || event.target;
    // We record the link data anyway, even if the glance may be invoked
    // or not. We have some cases where glance would open, for example,
    // when clicking on a link with a different domain where glance would open.
    // The problem is that at that stage we don't know the rect or even what
    // element has been clicked, so we send the data here.
    this.#sendClickDataToParent(target, elementToRecord);
    if (event.button !== 0 || event.defaultPrevented || this.#ensureOnlyKeyModifiers(event)) {
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
    if (target) {
      event.preventDefault();
      event.stopPropagation();

      this.#openGlance(target);
    }
  }

  on_keydown(event) {
    if (event.defaultPrevented || event.key !== 'Escape') {
      return;
    }
    this.sendAsyncMessage('ZenGlance:CloseGlance', {
      hasFocused: this.contentWindow.document.activeElement !== this.contentWindow.document.body,
    });
  }

  async on_DOMContentLoaded() {
    await this.#initActivationMethod();
  }
}
