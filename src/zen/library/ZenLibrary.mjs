// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

{
  const HERO_MARKUP = `
    <html:section id="zen-library-hero">
      <html:div class="zen-library-hero-inner">
        <html:div class="zen-library-hero-copy">
          <html:div class="zen-library-kicker">Zen Library</html:div>
          <html:h1 id="zen-library-title"></html:h1>
          <html:p id="zen-library-subtitle"></html:p>
          <html:div id="zen-library-search"></html:div>
        </html:div>
        <html:div class="zen-library-hero-stats">
          <html:div class="zen-library-stat">
            <html:span class="zen-library-stat-value" id="zen-library-count">0</html:span>
            <html:span class="zen-library-stat-label">items</html:span>
          </html:div>
          <html:div class="zen-library-stat">
            <html:span class="zen-library-stat-value" id="zen-library-scope">History</html:span>
            <html:span class="zen-library-stat-label">collection</html:span>
          </html:div>
        </html:div>
      </html:div>
    </html:section>
  `;

  const NUMBER_FORMAT = new Intl.NumberFormat();
  const SCOPE_LABELS = {
    history: "History",
    bookmarks: "Bookmarks",
    downloads: "Downloads",
  };

  let updateTimer = null;

  function ensureHero() {
    if (document.getElementById("zen-library-hero")) {
      return;
    }
    const fragment = window.MozXULElement.parseXULToFragment(HERO_MARKUP);
    const toolbox = document.getElementById("placesToolbox");
    if (!toolbox || !toolbox.parentNode) {
      return;
    }
    toolbox.after(fragment);
  }

  function moveSearch() {
    const search = document.getElementById("searchFilter");
    const target = document.getElementById("zen-library-search");
    if (!search || !target) {
      return;
    }
    search.removeAttribute("hidden");
    search.hidden = false;
    target.appendChild(search);
  }

  function getScope() {
    if (window.PlacesSearchBox && PlacesSearchBox.filterCollection) {
      return PlacesSearchBox.filterCollection;
    }
    const search = document.getElementById("searchFilter");
    return search?.getAttribute("collection") || "bookmarks";
  }

  function getTitle() {
    const placesList = document.getElementById("placesList");
    const node = placesList?.selectedNode;
    return node?.title || document.title || "Library";
  }

  function getItemCount() {
    const downloadsList = document.getElementById("downloadsListBox");
    if (downloadsList && !downloadsList.hidden) {
      return downloadsList.itemCount || downloadsList.childElementCount || 0;
    }
    const tree = document.getElementById("placeContent");
    if (tree?.view && typeof tree.view.rowCount === "number") {
      return tree.view.rowCount;
    }
    return 0;
  }

  function updateHero() {
    const root = document.getElementById("places");
    const title = getTitle();
    const scope = getScope();
    const scopeLabel = SCOPE_LABELS[scope] || scope;
    const count = getItemCount();
    const search = document.getElementById("searchFilter");
    const placeholder = search?.getAttribute("placeholder") || "";

    root?.setAttribute("data-zen-section", scope);
    root?.setAttribute("data-zen-library-ready", "true");

    const titleEl = document.getElementById("zen-library-title");
    if (titleEl) {
      titleEl.textContent = title;
    }

    const subtitleEl = document.getElementById("zen-library-subtitle");
    if (subtitleEl) {
      subtitleEl.textContent = placeholder;
      subtitleEl.toggleAttribute("hidden", !placeholder);
    }

    const countEl = document.getElementById("zen-library-count");
    if (countEl) {
      countEl.textContent = NUMBER_FORMAT.format(count);
    }

    const scopeEl = document.getElementById("zen-library-scope");
    if (scopeEl) {
      scopeEl.textContent = scopeLabel;
    }
  }

  function scheduleUpdate() {
    if (updateTimer) {
      clearTimeout(updateTimer);
    }
    updateTimer = setTimeout(() => {
      updateHero();
      updateTimer = null;
    }, 60);
  }

  function attachListeners() {
    const placesList = document.getElementById("placesList");
    placesList?.addEventListener("select", scheduleUpdate);
    placesList?.addEventListener("click", scheduleUpdate);

    const search = document.getElementById("searchFilter");
    search?.addEventListener("input", scheduleUpdate);
    search?.addEventListener("MozInputSearch:search", scheduleUpdate);
    search?.addEventListener("command", scheduleUpdate);

    const content = document.getElementById("placeContent");
    content?.addEventListener("select", scheduleUpdate);

    const downloadsList = document.getElementById("downloadsListBox");
    downloadsList?.addEventListener("select", scheduleUpdate);
  }

  function init() {
    ensureHero();
    moveSearch();
    updateHero();
    attachListeners();
    scheduleUpdate();
  }

  window.addEventListener("load", init, { once: true });
}
