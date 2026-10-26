/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  gZenBoostsManager: "resource:///modules/zen/boosts/ZenBoostsManager.sys.mjs",
});

const KILL_TOPIC = "zen-boosts-kill-share";

const SAFE_ICON_RE = /^(data:image\/|chrome:\/\/)/;
const SAFE_PREVIEW_RE = /^data:image\//;

/**
 * The dialog a shared boost arrives in.
 */
export class nsZenBoostReceiveDialog {
  /**
   * @param {Document} doc - The dialog's document.
   * @param {Window} win - The dialog's window.
   * @param {object} args
   * @param {Window} args.parentWindow - The browser window the link opened in.
   * @param {object} args.shared - The shared boost, as in share.schema.json.
   * @param {string} [args.author] - The sharer's name from the share server.
   *   `args.added` is set to true once the boost has been added, for the
   *   opener to act on after the dialog has closed.
   */
  constructor(doc, win, args) {
    const { parentWindow, shared, author } = args;
    this.doc = doc;
    this.win = win;
    this.args = args;
    this.openerWindow = parentWindow;
    this.shared = shared;
    this.author = shared.author || author || "";

    Services.obs.notifyObservers(null, KILL_TOPIC);
    Services.obs.addObserver(this, KILL_TOPIC);
    this.win.addEventListener(
      "unload",
      () => Services.obs.removeObserver(this, KILL_TOPIC),
      { once: true }
    );

    this.init();
  }

  /** @param {string} selector */
  $(selector) {
    return this.doc.querySelector(selector);
  }

  init() {
    const cancel = this.$("dialog").getButton("cancel");
    cancel.style.order = "-1";
    cancel.style.marginInlineEnd = "auto";
    this.doc.addEventListener("dialogaccept", () => this.onGetPressed());
    this.$(".zbs-info-button").addEventListener("click", event =>
      this.onBoostInfoButtonPressed(event)
    );

    const { domain, name: boostName, preview, signature, icon } = this.shared;
    this.$(".zbs-domain").textContent = domain;
    this.$(".zbs-name").textContent = boostName;
    const favicon =
      typeof icon === "string" && SAFE_ICON_RE.test(icon)
        ? icon
        : `page-icon:https://${domain}/#size=128`;
    this.$(".zbs-favicon").src = favicon;
    this.$(".zbs-screenshot-favicon").src = favicon;
    this.doc.l10n.setArgs(this.$("#zen-boost-receive-info-panel p"), {
      domain,
    });
    if (this.author) {
      this.$(".zbs-author-name").textContent = this.author;
    } else {
      this.$(".zbs-author").hidden = true;
    }
    if (typeof preview === "string" && SAFE_PREVIEW_RE.test(preview)) {
      this.$(".zbs-screenshot-image").src = preview;
    } else {
      this.$(".zbs-card").setAttribute("screenshot-hidden", "true");
    }
    if (signature) {
      this.drawSignature(signature);
    }
  }

  observe(subject, topic) {
    if (topic === KILL_TOPIC) {
      this.win.close();
    }
  }

  /**
   * Draws the sharer's strokes behind the boost's name.
   *
   * @param {{viewBox: string, paths: string[]}} signature
   */
  drawSignature({ viewBox, paths }) {
    const svg = this.$(".zbs-signature");
    svg.setAttribute("viewBox", viewBox);
    for (const d of paths) {
      const path = this.doc.createElementNS(
        "http://www.w3.org/2000/svg",
        "path"
      );
      path.setAttribute("d", d);
      path.setAttribute("fill", "none");
      path.setAttribute("stroke-linecap", "round");
      path.setAttribute("stroke-linejoin", "round");
      svg.appendChild(path);
    }
  }

  /**
   * Adds the boost for its site and turns it on. Opening the site is left to
   * the opener once the dialog is gone, so the new tab's selection sticks.
   */
  onGetPressed() {
    const { domain, name: boostName, boostData } = this.shared;
    const manager = lazy.gZenBoostsManager;
    const boost = manager.createNewBoost(domain);
    if (!boost) {
      return;
    }
    boost.boostEntry.boostData = manager.boostDataFromShared(
      boostData,
      boostName
    );
    manager.saveBoostToStore(boost);
    manager.makeBoostActiveForDomain(domain, boost.id);

    this.openerWindow.gZenUIManager?.showToast("zen-boost-received-toast");
    this.args.added = true;
  }

  /**
   * Explains what a boost can and cannot do, in a popup by the info button.
   *
   * @param {MouseEvent} event - The click on the info button.
   */
  onBoostInfoButtonPressed(event) {
    // To the right of the button, flipping to the left when there is no room.
    this.$("#zen-boost-receive-info-panel").openPopup(
      event.currentTarget,
      "end_before",
      4,
      0,
      false,
      false,
      event
    );
  }
}
