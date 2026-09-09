/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { html } from "chrome://global/content/vendor/lit.all.mjs";
import {
  ZenLibrarySearchSection,
} from "moz-src:///zen/library/sections/ZenLibrarySearchSection.mjs";


const lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  gZenBoostsManager: "resource:///modules/zen/boosts/ZenBoostsManager.sys.mjs",
});

export class ZenLibraryBoostsSection extends ZenLibrarySearchSection {
  static id = "boosts";
  static label = "library-boosts-section-title";

  #observer = null;
  #menu = null;
  #menuBoost = null;
  #menuRow = null;

  get searchPlaceholderL10nId() {
    return "library-boosts-search-placeholder";
  }

  static render(library) {
    return html`
      <zen-library-boosts-section
        class="zen-library-section"
        data-section="boosts"
        .library=${library}
      ></zen-library-boosts-section>
    `;
  }

  connectedCallback() {
    super.connectedCallback();
    this.#observer = () => this.requestUpdate();
    Services.obs.addObserver(this.#observer, "zen-boosts-update");
    Services.obs.addObserver(this.#observer, "zen-boosts-active-change");
    this.#menu = this.#buildMenu();
  }

  disconnectedCallback() {
    if (this.#observer) {
      Services.obs.removeObserver(this.#observer, "zen-boosts-update");
      Services.obs.removeObserver(this.#observer, "zen-boosts-active-change");
      this.#observer = null;
    }
    this.#menu?.hidePopup();
    this.#menu?.remove();
    this.#menu = null;
    this.#menuBoost = null;
    this.#menuRow = null;
    super.disconnectedCallback();
  }

  onSearchChanged() {
    this.requestUpdate();
  }

  #getBoosts() {
    const manager = lazy.gZenBoostsManager;
    if (!manager?.registeredDomains) {
      return [];
    }
    const term = this.searchQuery.trim().toLowerCase();
    const items = [];
    for (const [domain, entry] of manager.registeredDomains) {
      if (!entry?.boostEntries) {
        continue;
      }
      for (const [id, boostEntry] of entry.boostEntries) {
        const displayName = boostEntry.boostData?.boostName || "";
        if (
          term &&
          !displayName.toLowerCase().includes(term) &&
          !domain.toLowerCase().includes(term)
        ) {
          continue;
        }
        items.push({
          id,
          domain,
          name: displayName,
          isActive: entry.activeBoostId === id,
        });
      }
    }
    items.sort((a, b) =>
      (a.name || a.domain).localeCompare(b.name || b.domain)
    );
    return items;
  }

  #openBoost(boost) {
    const url = `https://${boost.domain}/`;
    this._openInGlance(url);
    try {
      const stored = lazy.gZenBoostsManager.loadBoostFromStore(
        boost.domain,
        boost.id
      );
      if (stored) {
        const uri = Services.io.newURI(url);
        lazy.gZenBoostsManager.openBoostWindow(window, stored, uri);
      }
    } catch (ex) {
      console.error(ex);
    }
  }

  _openInGlance(url) {
    const tabPanelRect = window.windowUtils.getBoundsWithoutFlushing(
      window.gBrowser.tabpanels
    );
    window.gZenGlanceManager.openGlance({
      url,
      clientX: window.innerWidth / 2 - tabPanelRect.left,
      clientY: window.innerHeight / 2 - tabPanelRect.top,
      width: 0,
      height: 0,
      triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal(),
    });
  }

  #toggle(boost) {
    lazy.gZenBoostsManager.toggleBoostActiveForDomain(boost.domain, boost.id);
  }

  async #export(boost) {
    const { boostEntry } = lazy.gZenBoostsManager.loadBoostFromStore(boost.domain, boost.id);
    const success = await lazy.gZenBoostsManager.exportBoost(
      window, boostEntry.boostData
    );

    if (success) {
      window.gZenUIManager.showToast(
        "zen-panel-ui-boosts-exported-message"
      );
    }
  }

  #delete(boost) {
    lazy.gZenBoostsManager.deleteBoost({
      domain: boost.domain,
      id: boost.id,
    });
  }

  #buildMenu() {
    const menu = window.MozXULElement.parseXULToFragment(`
      <menupopup class="zen-library-boosts-menu">
        <menuitem data-action="edit" data-l10n-id="library-boost-context-edit"/>
        <menuitem data-action="export" data-l10n-id="library-boost-context-export"/>
        <menuseparator/>
        <menuitem data-action="delete" data-l10n-id="library-boost-context-delete"/>
      </menupopup>
    `).firstElementChild;
    menu.addEventListener("command", event => {
      if (!this.#menuBoost) {
        return;
      }
      switch (event.target.dataset.action) {
        case "edit":
          this.#openBoost(this.#menuBoost);
          break;
        case "export":
          this.#export(this.#menuBoost);
          break;
        case "delete":
          this.#delete(this.#menuBoost);
          break;
      }
    });
    menu.addEventListener("popuphidden", () => {
      this.#menuRow?.removeAttribute("menu-open");
      this.#menuRow = null;
      this.#menuBoost = null;
    });
    document.getElementById("mainPopupSet").appendChild(menu);
    document.l10n.translateFragment(menu).catch(console.error);
    return menu;
  }

  #openMenu(boost, row, event) {
    this.#menuRow?.removeAttribute("menu-open");
    this.#menuBoost = boost;
    this.#menuRow = row;
    row.setAttribute("menu-open", "true");
    this.#menu.openPopupAtScreen(event.screenX, event.screenY, true, event);
  }

  renderItems() {
    const boosts = this.#getBoosts();
    if (boosts.length === 0) {
      return html`
        <div class="zen-library-empty" data-l10n-id="library-boosts-empty"></div>
      `;
    }
    return html`${boosts.map(b => this.#renderBoost(b))}`;
  }

  #renderBoost(boost) {
    return html`
      <div
        class="zen-library-row library-boost-item"
        data-key=${`${boost.domain}|${boost.id}`}
        ?active=${boost.isActive}
        @click=${() => this.#openBoost(boost)}
        @contextmenu=${event => {
          event.preventDefault();
          this.#openMenu(boost, event.currentTarget, event);
        }}
      >
        <span class="zen-library-row-icon-wrapper">
          <img
            class="zen-library-row-icon"
            src="page-icon:https://${boost.domain}/"
            alt=""
            ?inactive=${!boost.isActive}
          />
        </span>
        <div class="zen-library-row-text">
          <span class="zen-library-row-title"
            >${boost.name || boost.domain}</span
          >
          <span class="zen-library-row-subtitle">${boost.domain}</span>
        </div>
        <div class="zen-library-row-actions">
          <button
            class="library-toggle"
            data-l10n-id="library-toggle"
            role="switch"
            aria-checked=${boost.isActive ? "true" : "false"}
            ?checked=${boost.isActive}
            tabindex="-1"
            @click=${e => {
              e.stopPropagation();
              e.preventDefault();
              this.#toggle(boost);
            }}
            @auxclick=${e => e.stopPropagation()}
          >
            <span class="library-toggle-thumb"></span>
          </button>
        </div>
      </div>
    `;
  }

}

customElements.define("zen-library-boosts-section", ZenLibraryBoostsSection);