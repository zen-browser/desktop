

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
    this.container = this.window.document.getElementById("zen-highlight-container");
    this.searchBtn = this.window.document.getElementById("zen-highlight-btn-search");
    this.copyBtn = this.window.document.getElementById("zen-highlight-btn-copy");
    this.currencyEl = this.window.document.getElementById("zen-highlight-currency");
    this.currencyText = this.window.document.getElementById("zen-highlight-currency-text");

    if (this.searchBtn) {
      this.searchBtn.addEventListener("click", () => this.handleSearch());
    }
    if (this.copyBtn) {
      this.copyBtn.addEventListener("click", () => this.handleCopy());
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

  show(text, rect, browser) {
    this.debug('show called, text: ' + text.substring(0, 10));
    if (!this.container) this.debug('constructor -> init'); this.init(); // Fallback if init didn't catch elements
    if (!this.container) return;
    
    this.currentText = text;
    this.container.hidden = false;
    this._ensureTabSelectListener(); // Lazy-register tab switch listener
    
    // Convert absolute screen coordinates to relative chrome window coordinates
    let win = this.window;
    
    // Position above the selection
    let top = rect.screenY - win.mozInnerScreenY - 40; 
    let left = rect.screenX - win.mozInnerScreenX + (rect.width / 2) - (this.container.offsetWidth / 2);
    
    this.debug(`Calculated pos: top=${top}, left=${left} | winScreen: ${win.mozInnerScreenY}, ${win.mozInnerScreenX} | rectScreen: ${rect.screenY}, ${rect.screenX} | offsetWidth: ${this.container.offsetWidth}`);

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

  handleSearch() {
    if (!this.currentText) return;
    let url = "https://www.google.com/search?q=" + encodeURIComponent(this.currentText);
    this.window.gBrowser.loadOneTab(url, { inBackground: false });
    this.hide();
  }

  handleCopy() {
    if (!this.currentText) return;
    const clipboardHelper = Components.classes["@mozilla.org/widget/clipboardhelper;1"]
                            .getService(Components.interfaces.nsIClipboardHelper);
    clipboardHelper.copyString(this.currentText);
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
    let defaultCurrency = "CZK";
    try {
      defaultCurrency = Services.prefs.getStringPref("zen.highlight.default-currency", "CZK");
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

