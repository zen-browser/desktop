/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  PlacesUtils: "resource://gre/modules/PlacesUtils.sys.mjs",
  ZenShareClient: "resource:///modules/zen/share/ZenShareClient.sys.mjs",
});

const ICON_SIZE = 128;

const SHARE_DOCUMENT_VERSION = "1";
const DISPLAY_NAME_PREF = "zen.share.display-name";
const KILL_TOPIC = "zen-boosts-kill-share";

const SUCCESS_MIN_PULSE_MS = 900;
const SUCCESS_CLOSE_MS = 2200;

/**
 * The dialog a boost is shared from.
 */
export class nsZenBoostShareDialog {
  /**
   * @param {Document} doc - The dialog's document.
   * @param {Window} win - The dialog's window.
   * @param {object} args
   * @param {Window} args.parentWindow - The browser window sharing the boost.
   * @param {MozBrowser} [args.browser] - The browser showing the boosted page.
   * @param {object} args.boost - The boost: { id, domain, boostEntry }.
   */
  constructor(doc, win, { parentWindow, browser, boost }) {
    this.doc = doc;
    this.win = win;
    this.openerWindow = parentWindow;
    this.browser = browser ?? parentWindow?.gBrowser.selectedBrowser;
    this.boost = boost;

    this.currentSignaturePath = null;
    this.points = [];
    this.isPaneFlipped = false;
    this.hasSignature = false;
    this.hasScreenshot = false;
    this.hideScreenshot = false;
    this.iconDataUrl = null;
    this.isRemovingSignature = false;
    this.isSharing = false;

    Services.obs.notifyObservers(null, KILL_TOPIC);
    Services.obs.addObserver(this, KILL_TOPIC);
    this.win.addEventListener(
      "unload",
      () => Services.obs.removeObserver(this, KILL_TOPIC),
      { once: true }
    );

    this.init();
  }

  get boostData() {
    return this.boost.boostEntry.boostData;
  }

  /** @param {string} selector */
  $(selector) {
    return this.doc.querySelector(selector);
  }

  init() {
    const cancel = this.$("dialog").getButton("cancel");
    cancel.classList.add("ghost");
    cancel.style.order = "-1";
    cancel.style.setProperty("margin-inline-end", "auto", "important");
    this.doc.addEventListener("dialogaccept", event => {
      event.preventDefault();
      this.onSharePressed();
    });
    this.$(".zbs-pane-left").addEventListener("click", () =>
      this.onLeftPaneButtonClick()
    );
    this.$(".zbs-pane-right").addEventListener("click", event =>
      this.onRightPaneButtonClick(event)
    );
    this.$(".zbs-info-button").addEventListener("click", event =>
      this.$("#zen-boost-share-info-panel").openPopup(
        event.currentTarget,
        "end_before",
        4,
        0,
        false,
        false,
        event
      )
    );
    this.$("#zbs-hide-screenshot").addEventListener("command", () =>
      this.setScreenshotHidden(!this.hideScreenshot)
    );

    this.$(".zbs-name").value = this.boostData.boostName;
    this.$(".zbs-author-name").value = Services.prefs.getStringPref(
      DISPLAY_NAME_PREF,
      ""
    );
    // Decode the heart up front so the first fade-in does not stall on it.
    this.$(".zbs-success-heart img")
      ?.decode?.()
      .catch(() => {});

    this.initIcon();
    this.initSignature();
    this.updatePaneButtonStyle();
    this.win.requestAnimationFrame(() => this.initCapturedSite());
  }

  observe(subject, topic) {
    if (topic === KILL_TOPIC) {
      this.win.close();
    }
  }

  /**
   * Shows the biggest icon Places has for the boosted page, as a data url
   * that can travel with the share. Falls back to the site's page icon.
   */
  async initIcon() {
    const pageUri = this.browser?.currentURI;
    const fallback = `page-icon:${
      pageUri?.spec ?? `https://${this.boost.domain}/`
    }#size=${ICON_SIZE}`;
    let src = fallback;
    if (pageUri) {
      try {
        const favicon = await lazy.PlacesUtils.favicons.getFaviconForPage(
          pageUri,
          ICON_SIZE
        );
        if (favicon?.dataURI) {
          this.iconDataUrl = favicon.dataURI.spec;
          src = this.iconDataUrl;
        }
      } catch (ex) {
        console.error("ZenBoostShare: could not read the page icon:", ex);
      }
    }
    if (!this.win.closed) {
      this.$(".zbs-favicon").src = src;
      this.$(".zbs-screenshot-favicon").src = src;
    }
  }

  /**
   * Captures the boosted page and shows it in the preview, where the user
   * can zoom in with the wheel and drag it around to frame the share.
   */
  async initCapturedSite() {
    const canvas = this.$(".zbs-screenshot canvas");
    const windowGlobal = this.browser?.browsingContext?.currentWindowGlobal;
    if (!canvas || !windowGlobal) {
      return;
    }
    const scale = this.openerWindow.devicePixelRatio || 1;
    canvas.width = canvas.clientWidth * scale;
    canvas.height = canvas.clientHeight * scale;
    try {
      this.snapshot = await windowGlobal.drawSnapshot(
        null,
        scale,
        "rgb(255,255,255)"
      );
    } catch (ex) {
      console.error("ZenBoostShare: could not capture the page:", ex);
      return;
    }
    this.win.addEventListener("unload", () => this.snapshot?.close(), {
      once: true,
    });
    this.hasScreenshot = true;
    this.view = { zoom: 1, x: 0, y: 0 };
    this.drawScreenshot();
    this.initScreenshotFraming(canvas);
  }

  /**
   * Draws the snapshot at the current zoom and offset. At zoom 1 the page
   * covers the preview; zooming enlarges it from there and the offset
   * slides it, never past its edges.
   */
  drawScreenshot() {
    const canvas = this.$(".zbs-screenshot canvas");
    const { snapshot, view } = this;
    if (!canvas || !snapshot) {
      return;
    }
    const cover = Math.max(
      canvas.width / snapshot.width,
      canvas.height / snapshot.height
    );
    const width = snapshot.width * cover * view.zoom;
    const height = snapshot.height * cover * view.zoom;
    view.x = Math.min(0, Math.max(canvas.width - width, view.x));
    view.y = Math.min(0, Math.max(canvas.height - height, view.y));
    const context = canvas.getContext("2d");
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(snapshot, view.x, view.y, width, height);
  }

  static MAX_SCREENSHOT_ZOOM = 4;
  static WHEEL_ZOOM_STEP = 1.1;

  /**
   * Pinching (a wheel event with the control or command key, which is how
   * trackpad pinches arrive) and the notches of a mouse wheel zoom around
   * the pointer.
   *
   * @param {HTMLCanvasElement} canvas
   */
  initScreenshotFraming(canvas) {
    const scale = () => canvas.width / canvas.clientWidth;
    canvas.addEventListener("wheel", event => {
      event.preventDefault();
      const { view } = this;
      const isPinch = event.ctrlKey || event.metaKey;
      const isMouseWheel = event.deltaMode !== WheelEvent.DOM_DELTA_PIXEL;
      if (!isPinch && !isMouseWheel) {
        // Trackpad scroll: slide, in canvas pixels.
        view.x -= event.deltaX * scale();
        view.y -= event.deltaY * scale();
        this.drawScreenshot();
        return;
      }
      let factor;
      if (isPinch) {
        factor = Math.exp(-event.deltaY * 0.01);
      } else {
        const step = nsZenBoostShareDialog.WHEEL_ZOOM_STEP;
        factor = event.deltaY < 0 ? step : 1 / step;
      }
      factor = Math.min(1.25, Math.max(0.8, factor));
      const zoom = Math.min(
        nsZenBoostShareDialog.MAX_SCREENSHOT_ZOOM,
        Math.max(1, view.zoom * factor)
      );
      if (zoom === view.zoom) {
        return;
      }
      const rect = canvas.getBoundingClientRect();
      const px = (event.clientX - rect.left) * scale();
      const py = (event.clientY - rect.top) * scale();
      // Keep the page point under the pointer where it is.
      const ratio = zoom / view.zoom;
      view.x = px - (px - view.x) * ratio;
      view.y = py - (py - view.y) * ratio;
      view.zoom = zoom;
      this.drawScreenshot();
    });

    let drag = null;
    canvas.addEventListener("mousedown", event => {
      if (event.button !== 0) {
        return;
      }
      event.preventDefault();
      drag = { x: event.clientX, y: event.clientY };
      canvas.setAttribute("dragging", "true");
    });
    this.doc.addEventListener("mousemove", event => {
      if (!drag) {
        return;
      }
      this.view.x += (event.clientX - drag.x) * scale();
      this.view.y += (event.clientY - drag.y) * scale();
      drag = { x: event.clientX, y: event.clientY };
      this.drawScreenshot();
    });
    this.doc.addEventListener("mouseup", () => {
      drag = null;
      canvas.removeAttribute("dragging");
    });
  }

  /**
   * Leaves the screenshot out of the share, or puts it back.
   *
   * @param {boolean} hidden
   */
  setScreenshotHidden(hidden) {
    this.hideScreenshot = hidden;
    this.$(".zbs-card").toggleAttribute("screenshot-hidden", hidden);
    this.$("#zbs-hide-screenshot").setAttribute("checked", String(hidden));
  }

  /**
   * Uploads the boost and copies its link, with the heart pulsing while the
   * upload runs.
   */
  async onSharePressed() {
    if (this.isSharing) {
      return;
    }
    this.isSharing = true;
    const dialog = this.$("dialog");
    const nameInput = this.$(".zbs-name");
    const authorInput = this.$(".zbs-author-name");
    const animation = this.$(".zbs-success");
    dialog.getButton("accept").disabled = true;
    nameInput.blur();
    authorInput.blur();
    animation.setAttribute("showing", "true");
    const started = Date.now();

    const boostName = nameInput.value.trim() || this.boostData.boostName;
    const author = authorInput.value.trim();
    const shared = {
      type: "boost",
      name: boostName,
      domain: this.boost.domain,
      boostData: { ...this.boostData, boostName },
    };
    if (author) {
      shared.author = author;
    }
    if (this.iconDataUrl) {
      shared.icon = this.iconDataUrl;
    }
    const signature = this.serializeSignature();
    if (signature) {
      shared.signature = signature;
    }
    if (this.hasScreenshot && !this.hideScreenshot) {
      shared.preview = this.$(".zbs-screenshot canvas").toDataURL(
        "image/jpeg",
        0.85
      );
    }

    try {
      const share = await lazy.ZenShareClient.findOrCreateShare(
        { version: SHARE_DOCUMENT_VERSION, shared },
        { name: author || undefined }
      );
      Services.prefs.setStringPref(DISPLAY_NAME_PREF, author);
      Cc["@mozilla.org/widget/clipboardhelper;1"]
        .getService(Ci.nsIClipboardHelper)
        .copyString(share.link);
      const remaining = SUCCESS_MIN_PULSE_MS - (Date.now() - started);
      this.win.setTimeout(
        () => {
          animation.setAttribute("done", "true");
          this.win.setTimeout(() => this.win.close(), SUCCESS_CLOSE_MS);
        },
        Math.max(0, remaining)
      );
    } catch (e) {
      animation.removeAttribute("showing");
      this.openerWindow.gZenShareManager?.showCreateError(e);
      dialog.getButton("accept").disabled = false;
      this.isSharing = false;
    }
  }

  /* Mark: signature */

  initSignature() {
    const svg = this.$(".zbs-signature");
    this.doc.addEventListener("mouseup", () => this.signatureMouseUp());
    svg.addEventListener("mousedown", event => this.signatureMouseDown(event));
    svg.addEventListener("mousemove", event => this.signatureMouseMove(event));
    this.win.requestAnimationFrame(() => {
      const rect = svg.getBoundingClientRect();
      svg.setAttribute("viewBox", `0 0 ${rect.width} ${rect.height}`);
    });
  }

  /**
   * @returns {?{viewBox: string, paths: string[]}} The drawn strokes, or
   *   null when nothing was drawn.
   */
  serializeSignature() {
    if (!this.hasSignature) {
      return null;
    }
    const svg = this.$(".zbs-signature");
    const paths = [...svg.querySelectorAll("path")]
      .map(path => path.getAttribute("d"))
      .filter(Boolean);
    if (!paths.length) {
      return null;
    }
    return { viewBox: svg.getAttribute("viewBox"), paths };
  }

  signatureMouseDown(event) {
    if (this.isRemovingSignature) {
      return;
    }
    const svg = this.$(".zbs-signature");
    const coords = this.mouseToSignatureCoords(event);
    this.points = [coords];
    const path = this.doc.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", `M${coords.x} ${coords.y}`);
    path.setAttribute("fill", "none");
    path.setAttribute("stroke-linecap", "round");
    path.setAttribute("stroke-linejoin", "round");
    svg.appendChild(path);
    this.currentSignaturePath = path;
    this.hasSignature = true;
    this.updatePaneButtonStyle();
  }

  signatureMouseUp() {
    this.currentSignaturePath = null;
    this.points = [];
  }

  signatureMouseMove(event) {
    if (!this.currentSignaturePath || this.isRemovingSignature) {
      return;
    }
    const coords = this.mouseToSignatureCoords(event);
    const last = this.points[this.points.length - 1];
    if (!last || this.distance(coords, last) > 2) {
      this.points.push(coords);
      this.currentSignaturePath.setAttribute(
        "d",
        this.buildSmoothPath(this.points)
      );
    }
  }

  resetSignature() {
    if (this.isRemovingSignature) {
      return;
    }
    const svg = this.$(".zbs-signature");
    const strokeLength = this.getSignatureLength();
    svg.style.setProperty("--stroke-length", strokeLength);
    svg.style.setProperty("--stroke-offset", -strokeLength);
    svg.classList.add("zbs-stroke-out");
    this.isRemovingSignature = true;
    this.win.setTimeout(() => {
      svg.replaceChildren();
      this.points = [];
      this.currentSignaturePath = null;
      this.hasSignature = false;
      this.isRemovingSignature = false;
      svg.classList.remove("zbs-stroke-out");
      this.updatePaneButtonStyle();
    }, 1000);
  }

  getSignatureLength() {
    let longest = 0;
    for (const path of this.doc.querySelectorAll(".zbs-signature path")) {
      longest = Math.max(longest, path.getTotalLength());
    }
    return Math.round(longest);
  }

  buildSmoothPath(points) {
    if (points.length < 2) {
      return `M${points[0].x} ${points[0].y}`;
    }
    let d = `M${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length - 1; i++) {
      const midX = (points[i].x + points[i + 1].x) / 2;
      const midY = (points[i].y + points[i + 1].y) / 2;
      d += ` Q${points[i].x} ${points[i].y} ${midX} ${midY}`;
    }
    const last = points[points.length - 1];
    return d + ` L${last.x} ${last.y}`;
  }

  distance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  mouseToSignatureCoords(event) {
    const svg = this.$(".zbs-signature");
    const rect = svg.getBoundingClientRect();
    const [, , width, height] = svg
      .getAttribute("viewBox")
      .split(" ")
      .map(parseFloat);
    return {
      x: (event.clientX - rect.left) * (width / rect.width),
      y: (event.clientY - rect.top) * (height / rect.height),
    };
  }

  /* Mark: preview pane */

  onLeftPaneButtonClick() {
    this.isPaneFlipped = !this.isPaneFlipped;
    this.$(".zbs-pane").setAttribute("flipped", this.isPaneFlipped);
    this.updatePaneButtonStyle();
  }

  onRightPaneButtonClick(event) {
    if (!this.isPaneFlipped) {
      this.$("#zbs-screenshot-menu").openPopup(
        event.currentTarget,
        "after_end",
        0,
        4
      );
      return;
    }
    if (this.hasSignature) {
      this.resetSignature();
    }
    this.updatePaneButtonStyle();
  }

  /**
   * The pane buttons show the signature pen on the screenshot side and, on
   * the signature side, a confirm or back arrow next to a clear button.
   */
  updatePaneButtonStyle() {
    const left = this.$(".zbs-pane-left");
    const right = this.$(".zbs-pane-right");
    const describe = (button, icon, l10nId) => {
      button.setAttribute("icon", icon);
      this.doc.l10n.setAttributes(button, l10nId);
    };
    right.removeAttribute("disabled");
    if (!this.isPaneFlipped) {
      describe(left, "signature", "zen-boost-share-pane-sign");
      describe(right, "menu", "zen-boost-share-pane-screenshot-menu");
      return;
    }
    describe(right, "remove", "zen-boost-share-pane-clear");
    if (this.hasSignature) {
      describe(left, "check", "zen-boost-share-pane-done");
    } else {
      describe(left, "back", "zen-boost-share-pane-back");
      right.setAttribute("disabled", "true");
    }
  }
}
