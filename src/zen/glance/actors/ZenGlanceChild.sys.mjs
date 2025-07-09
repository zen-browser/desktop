// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.
export class ZenGlanceChild extends JSWindowActorChild {
  constructor() {
    super();

    this.mouseUpListener = this.handleMouseUp.bind(this);
    this.mouseDownListener = this.handleMouseDown.bind(this);
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

  async getActivationMethod() {
    if (this._activationMethod === undefined) {
      this._activationMethod = await this.sendQuery('ZenGlance:GetActivationMethod');
    }
    return this._activationMethod;
  }

  async getHoverActivationDelay() {
    if (this._hoverActivationDelay === undefined) {
      this._hoverActivationDelay = await this.sendQuery('ZenGlance:GetHoverActivationDelay');
    }
    return this._hoverActivationDelay;
  }

  async receiveMessage(message) {
    switch (message.name) {
    }
  }

  async initiateGlance() {
    this.mouseIsDown = false;
    const activationMethod = await this.getActivationMethod();
    if (activationMethod === 'mantain') {
      this.contentWindow.addEventListener('mousedown', this.mouseDownListener);
      this.contentWindow.addEventListener('mouseup', this.mouseUpListener);

      this.contentWindow.document.removeEventListener('click', this.clickListener);
    } else if (
      activationMethod === 'ctrl' ||
      activationMethod === 'alt' ||
      activationMethod === 'shift'
    ) {
      this.contentWindow.document.addEventListener('click', this.clickListener, { capture: true });

      this.contentWindow.removeEventListener('mousedown', this.mouseDownListener);
      this.contentWindow.removeEventListener('mouseup', this.mouseUpListener);
    }
  }

  ensureOnlyKeyModifiers(event) {
    return !(event.ctrlKey ^ event.altKey ^ event.shiftKey ^ event.metaKey);
  }

  openGlance(target) {
    let url = target.href;
    // Add domain to relative URLs
    if (!url.match(/^(?:[a-z]+:)?\/\//i)) {
      url = this.contentWindow.location.origin + url;
    }
    const rect = target.getBoundingClientRect();
    this.sendAsyncMessage('ZenGlance:OpenGlance', {
      url,
      clientX: rect.left,
      clientY: rect.top,
      width: rect.width,
      height: rect.height,
    });
  }

  handleMouseUp(event) {
    if (this.hasClicked) {
      event.preventDefault();
      event.stopPropagation();
      this.hasClicked = false;
    }
    this.mouseIsDown = null;
  }

  async handleMouseDown(event) {
    const target = event.target.closest('A');
    if (!target) {
      return;
    }
    this.mouseIsDown = target;
    const hoverActivationDelay = await this.getHoverActivationDelay();
    this.contentWindow.setTimeout(() => {
      if (this.mouseIsDown === target) {
        this.hasClicked = true;
        this.openGlance(target);
      }
    }, hoverActivationDelay);
  }

  handleClick(event) {
    if (this.ensureOnlyKeyModifiers(event) || event.button !== 0 || event.defaultPrevented) {
      return;
    }
    const activationMethod = this._activationMethod;
    if (activationMethod === 'ctrl' && !event.ctrlKey) {
      return;
    } else if (activationMethod === 'alt' && !event.altKey) {
      return;
    } else if (activationMethod === 'shift' && !event.shiftKey) {
      return;
    } else if (activationMethod === 'meta' && !event.metaKey) {
      return;
    } else if (activationMethod === 'mantain' || typeof activationMethod === 'undefined') {
      return;
    }
    // get closest A element
    const target = event.target.closest('A');
    if (target) {
      event.preventDefault();
      event.stopPropagation();

      this.openGlance(target);
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
