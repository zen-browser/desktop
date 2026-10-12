export class nsZenHighlightManager {
  debug(msg) { dump("ZEN_HIGHLIGHT_MANAGER: " + msg + "\n"); console.debug("ZenHighlightManager:", msg); }
  constructor() {
    this.window = window;
    if (this.window.document.readyState === "complete" || this.window.document.readyState === "interactive") {
      this.debug('constructor -> init'); this.init();
    } else {
      this.window.addEventListener("DOMContentLoaded", () => this.init());
    }
  }

  init() {
    if (this._initialized) return;

    this.container = this.window.document.getElementById("zen-highlight-container");
    this.searchBtn = this.window.document.getElementById("zen-highlight-btn-search");
    this.copyBtn = this.window.document.getElementById("zen-highlight-btn-copy");
    this.currencyEl = this.window.document.getElementById("zen-highlight-currency");
    this.currencyText = this.window.document.getElementById("zen-highlight-currency-text");

    if (!this.container) return; // Elements not yet in DOM
    this._initialized = true;

    if (this.container) {
      this.container.addEventListener("mousedown", (e) => {
        e.preventDefault();
        e.stopPropagation();
      });
      this.container.addEventListener("click", (e) => {
        e.stopPropagation();
      });
    }
    if (this.searchBtn) {
      this.searchBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.handleSearch();
      });
    }
    if (this.copyBtn) {
      this.copyBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.handleCopy();
      });
    }
    if (this.currencyEl) {
      this.currencyEl.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (this.currencyText?.textContent) {
          this.copyStringToClipboard(this.currencyText.textContent);
          this.hide();
        }
      });
    }
    
    this.currentText = "";
    this.ratesCache = null;
    this.ratesCacheTime = 0;
    this._checkGeneration = 0; // Prevents stale async results from showing
    this._tabSelectRegistered = false;

    // Hide popup on scroll
    this._scrollHandler = () => this.hide();
    // Hide popup on tab switch
    this._tabSelectHandler = () => this.hide();
  }

  _ensureTabSelectListener() {
    if (this._tabSelectRegistered) return;
    if (!this.window.gBrowser?.tabContainer) return;
    this.window.gBrowser.tabContainer.addEventListener("TabSelect", this._tabSelectHandler);
    this._tabSelectRegistered = true;
  }

  updateThemeState() {
    let hasCustomColor = false;
    let bgAlpha = null;
    try {
      let workspace = this.window.gZenWorkspaces?.getActiveWorkspace();
      if (workspace?.theme?.colors && workspace.theme.colors.length > 0) {
        hasCustomColor = true;
      }
      if (typeof workspace?.theme?.opacity === "number") {
        let t = (workspace.theme.opacity - 0.25) / (0.9 - 0.25);
        t = Math.max(0, Math.min(1, t));
        bgAlpha = (0.70 - (t * 0.40)).toFixed(2);
      }
    } catch (e) {}

    try {
      let prefAccent = Services.prefs.getStringPref("zen.theme.accent-color", "AccentColor");
      if (prefAccent && prefAccent !== "AccentColor" && prefAccent.toLowerCase() !== "accentcolor") {
        hasCustomColor = true;
      }
    } catch (e) {}

    if (hasCustomColor) {
      this.container.setAttribute("has-custom-color", "true");
    } else {
      this.container.removeAttribute("has-custom-color");
    }

    if (bgAlpha) {
      this.container.style.setProperty("--zen-highlight-custom-alpha", bgAlpha);
    } else {
      this.container.style.removeProperty("--zen-highlight-custom-alpha");
    }
  }

  show(text, rect, browser) {
    this.debug('show called, text: ' + text.substring(0, 10));
    if (!this.container) {
      this.debug('constructor -> init');
      this.init();
    }
    if (!this.container) return;
    
    this.currentText = text;
    this.container.hidden = false;
    this.updateThemeState();
    this._ensureTabSelectListener(); // Lazy-register tab switch listener
    
    // Convert absolute screen coordinates to relative chrome window coordinates
    let win = this.window;
    
    let containerHeight = this.container.offsetHeight || 40;
    let containerWidth = this.container.offsetWidth || 190;
    
    // Position comfortably above the selection with 12px gap
    let top = rect.screenY - win.mozInnerScreenY - containerHeight - 12;
    let left = rect.screenX - win.mozInnerScreenX + (rect.width / 2) - (containerWidth / 2);

    // If selection is too close to top of window, show below the selection instead
    if (top < 10) {
      top = rect.screenY - win.mozInnerScreenY + rect.height + 12;
    }

    // Keep horizontally within window bounds
    let maxLeft = win.innerWidth - containerWidth - 12;
    left = Math.max(12, Math.min(left, maxLeft));
    
    this.debug(`Calculated pos: top=${top}, left=${left} | winScreen: ${win.mozInnerScreenY}, ${win.mozInnerScreenX} | rectScreen: ${rect.screenY}, ${rect.screenX} | offsetWidth: ${containerWidth}, offsetHeight: ${containerHeight}`);

    this.container.style.top = `${top}px`;
    this.container.style.left = `${left}px`;
    
    // Small timeout to allow display:block to apply before changing opacity for transition
    this.window.setTimeout(() => {
      this.container.setAttribute("visible", "true");
    }, 10);
    
    // Reset and check currency
    this.currencyEl.hidden = true;
    this.currencyText.textContent = "";
    this._checkGeneration++; // Invalidate any in-flight currency checks
    this.checkCurrency(text, this._checkGeneration);
  }

  hide() {
    if (!this.container) return;
    this.container.removeAttribute("visible");
    this.window.setTimeout(() => {
      if (!this.container.hasAttribute("visible")) {
        this.container.hidden = true;
      }
    }, 150); // wait for transition
  }

  async handleSearch() {
    this.debug("handleSearch called, text: " + this.currentText);
    if (!this.currentText) return;
    
    let url = "https://www.google.com/search?q=" + encodeURIComponent(this.currentText);
    
    try {
      let engine;
      if (Services.search && Services.search.getDefault) {
        engine = await Services.search.getDefault();
      } else {
        const { SearchService } = ChromeUtils.importESModule("resource://gre/modules/SearchService.sys.mjs");
        engine = await SearchService.getDefault();
      }
      
      let submission = engine.getSubmission(this.currentText, null, "searchbar");
      url = submission.uri.spec;
    } catch(e) {
      console.error("Zen Highlight Search Error (fallback to Google):", e);
    }
    
    try {
      let loadInBackground = false; // Default to switching to the new tab
      try {
        loadInBackground = Services.prefs.getBoolPref("zen.highlight.search-in-background", false);
      } catch (e) {}

      let newTab = this.window.gBrowser.addTab(url, { 
        triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal(),
        inBackground: loadInBackground
      });
      if (!loadInBackground && newTab) {
        this.window.gBrowser.selectedTab = newTab;
      }
    } catch (e) {
      console.error("Zen Highlight: Failed to open tab:", e);
    }
    
    this.hide();
  }

  copyStringToClipboard(str) {
    if (!str) return;
    try {
      if (typeof Cc !== "undefined" && typeof Ci !== "undefined") {
        Cc["@mozilla.org/widget/clipboardhelper;1"]
          .getService(Ci.nsIClipboardHelper)
          .copyString(str);
        return;
      }
    } catch (e) {
      console.warn("Cc clipboard helper failed:", e);
    }
    try {
      const clipboardHelper = Components.classes["@mozilla.org/widget/clipboardhelper;1"]
                              ?.getService(Components.interfaces.nsIClipboardHelper);
      if (clipboardHelper) {
        clipboardHelper.copyString(str);
        return;
      }
    } catch (e) {
      console.warn("Components clipboard helper failed:", e);
    }
    try {
      if (this.window.navigator?.clipboard?.writeText) {
        this.window.navigator.clipboard.writeText(str);
      }
    } catch (e) {
      console.error("Zen Highlight Copy Error:", e);
    }
  }

  handleCopy() {
    this.debug("handleCopy called, text: " + this.currentText);
    if (!this.currentText) return;
    this.copyStringToClipboard(this.currentText);
    this.hide();
  }

  async fetchRates() {
    const now = Date.now();
    if (this.ratesCache && (now - this.ratesCacheTime < 1000 * 60 * 60 * 4)) {
      return this.ratesCache; // Cache for 4 hours
    }
    try {
      let resp = await this.window.fetch("https://open.er-api.com/v6/latest/USD");
      let data = await resp.json();
      if (data && data.rates) {
        this.ratesCache = data.rates;
        this.ratesCacheTime = now;
        return this.ratesCache;
      }
    } catch (e) {
      console.error("Zen Highlight: Failed to fetch currency rates", e);
    }
    return null;
  }

  async checkCurrency(text, generation) {
    // Only match patterns like "10$", "10.50 $", "$10", "10 USD", "10 €", "10 EUR"
    const match = text.match(/^(\$|€|£)?\s*(\d+[.,]?\d*)\s*(\$|€|£|USD|EUR|GBP|CZK)?$/i);
    if (!match) return;

    let [, prefix, amountStr, suffix] = match;
    let symbol = prefix || suffix;
    if (!symbol) return;

    let currencyCode = "";
    if (symbol.toUpperCase() === 'USD' || symbol === '$') currencyCode = "USD";
    else if (symbol.toUpperCase() === 'EUR' || symbol === '€') currencyCode = "EUR";
    else if (symbol.toUpperCase() === 'GBP' || symbol === '£') currencyCode = "GBP";
    else if (symbol.toUpperCase() === 'CZK') currencyCode = "CZK";
    else return;

    let amount = parseFloat(amountStr.replace(',', '.'));
    if (isNaN(amount)) return;

    let defaultCurrency = "EUR";
    try {
      defaultCurrency = Services.prefs.getStringPref("zen.highlight.default-currency", "EUR");
    } catch(e) {}

    if (currencyCode === defaultCurrency) return;

    let rates = await this.fetchRates();

    // Check if this result is still relevant (user may have changed selection)
    if (generation !== this._checkGeneration) return;

    if (!rates || !rates[currencyCode] || !rates[defaultCurrency]) return;

    // Convert: source -> Default
    let amountInUsd = amount / rates[currencyCode];
    let converted = amountInUsd * rates[defaultCurrency];
    
    let formatted = new Intl.NumberFormat(this.window.navigator.language, { style: 'currency', currency: defaultCurrency }).format(converted);
    
    this.currencyText.textContent = formatted;
    this.currencyEl.hidden = false;
  }
}

if (!window.gZenHighlightManager) {
  window.gZenHighlightManager = new nsZenHighlightManager();
}
