// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { nsZenDOMOperatedFeature } from "chrome://browser/content/zen-components/ZenCommonUtils.mjs";

const INDIA_EMOJI_LIBRARY = Object.freeze([
  { emoji: "🇮🇳", category: "essentials", tags: ["india", "flag", "bharat", "desh"], order: 1 },
  { emoji: "🪔", category: "festivals", tags: ["diwali", "diya", "festival", "india"], order: 2 },
  { emoji: "🙏", category: "essentials", tags: ["namaste", "prayer", "greeting", "respect"], order: 3 },
  { emoji: "🏏", category: "fun", tags: ["cricket", "sports", "india", "ipl"], order: 4 },
  { emoji: "🚆", category: "productivity", tags: ["rail", "travel", "irctc", "train"], order: 5 },
  { emoji: "📚", category: "productivity", tags: ["study", "education", "exam", "library"], order: 6 },
  { emoji: "💼", category: "productivity", tags: ["work", "office", "business", "startup"], order: 7 },
  { emoji: "📈", category: "productivity", tags: ["growth", "stocks", "trading", "analytics"], order: 8 },
  { emoji: "💳", category: "productivity", tags: ["payments", "upi", "banking", "finance"], order: 9 },
  { emoji: "🏦", category: "productivity", tags: ["bank", "finance", "money", "savings"], order: 10 },
  { emoji: "🧾", category: "productivity", tags: ["gst", "tax", "invoice", "billing"], order: 11 },
  { emoji: "📅", category: "productivity", tags: ["calendar", "plan", "schedule", "meeting"], order: 12 },
  { emoji: "🧑‍💻", category: "productivity", tags: ["coding", "developer", "engineering", "software"], order: 13 },
  { emoji: "🎯", category: "productivity", tags: ["goal", "focus", "target", "priority"], order: 14 },
  { emoji: "🛡️", category: "essentials", tags: ["safe", "security", "privacy", "guard"], order: 15 },
  { emoji: "📍", category: "essentials", tags: ["location", "map", "city", "india"], order: 16 },
  { emoji: "🌼", category: "festivals", tags: ["flower", "marigold", "decor", "festival"], order: 17 },
  { emoji: "🎆", category: "festivals", tags: ["celebration", "fireworks", "diwali", "event"], order: 18 },
  { emoji: "🎊", category: "festivals", tags: ["celebrate", "event", "party", "festival"], order: 19 },
  { emoji: "🧵", category: "festivals", tags: ["craft", "thread", "handmade", "tradition"], order: 20 },
  { emoji: "☕", category: "fun", tags: ["tea", "chai", "break", "refresh"], order: 21 },
  { emoji: "🫖", category: "fun", tags: ["chai", "tea", "home", "relax"], order: 22 },
  { emoji: "🍛", category: "fun", tags: ["food", "curry", "meal", "india"], order: 23 },
  { emoji: "🐘", category: "fun", tags: ["elephant", "heritage", "wildlife", "india"], order: 24 },
  { emoji: "🦚", category: "fun", tags: ["peacock", "national bird", "india", "colorful"], order: 25 },
  { emoji: "🐅", category: "fun", tags: ["tiger", "wildlife", "india", "strength"], order: 26 },
  { emoji: "🏖️", category: "fun", tags: ["goa", "beach", "travel", "holiday"], order: 27 },
  { emoji: "🏔️", category: "fun", tags: ["himalaya", "mountain", "travel", "nature"], order: 28 },
  { emoji: "🎵", category: "fun", tags: ["music", "bollywood", "audio", "mood"], order: 29 },
  { emoji: "🧠", category: "productivity", tags: ["learning", "ideas", "thinking", "smart"], order: 30 },
]);

const INDIA_SVG_LIBRARY = Object.freeze([
  {
    icon: "india-flag.svg",
    category: "essentials",
    label: "India Flag",
    tags: ["india", "flag", "bharat", "country"],
  },
  {
    icon: "rupee-india.svg",
    category: "productivity",
    label: "Rupee",
    tags: ["rupee", "finance", "money", "upi", "payments"],
  },
  {
    icon: "lotus-india.svg",
    category: "essentials",
    label: "Lotus",
    tags: ["lotus", "heritage", "culture", "india"],
  },
  {
    icon: "diya-india.svg",
    category: "festivals",
    label: "Diya",
    tags: ["diya", "diwali", "festival", "light"],
  },
  {
    icon: "train-india.svg",
    category: "productivity",
    label: "Train",
    tags: ["train", "rail", "travel", "irctc", "commute"],
  },
  {
    icon: "rickshaw-india.svg",
    category: "fun",
    label: "Auto Rickshaw",
    tags: ["rickshaw", "transport", "city", "india"],
  },
  {
    icon: "taj-mahal-india.svg",
    category: "fun",
    label: "Taj Mahal",
    tags: ["taj mahal", "monument", "travel", "india"],
  },
  {
    icon: "spice-india.svg",
    category: "fun",
    label: "Spice",
    tags: ["spice", "food", "cooking", "india"],
  },
  {
    icon: "chai-kulhad-india.svg",
    category: "fun",
    label: "Chai",
    tags: ["chai", "tea", "kulhad", "break"],
  },
  {
    icon: "yoga-india.svg",
    category: "essentials",
    label: "Yoga",
    tags: ["yoga", "health", "wellness", "focus"],
  },
  {
    icon: "mandala-india.svg",
    category: "festivals",
    label: "Mandala",
    tags: ["mandala", "rangoli", "festival", "art"],
  },
  {
    icon: "startup-india.svg",
    category: "productivity",
    label: "Startup",
    tags: ["startup", "innovation", "build", "growth"],
  },
  {
    icon: "book.svg",
    category: "productivity",
    label: "Book",
    tags: ["study", "learning", "education"],
  },
  {
    icon: "briefcase.svg",
    category: "productivity",
    label: "Briefcase",
    tags: ["work", "office", "business"],
  },
  {
    icon: "stats-chart.svg",
    category: "productivity",
    label: "Stats",
    tags: ["analytics", "growth", "numbers", "market"],
  },
  {
    icon: "wallet.svg",
    category: "productivity",
    label: "Wallet",
    tags: ["finance", "money", "budget", "payments"],
  },
  {
    icon: "rocket.svg",
    category: "productivity",
    label: "Rocket",
    tags: ["launch", "build", "ideas", "momentum"],
  },
  {
    icon: "present.svg",
    category: "festivals",
    label: "Gift",
    tags: ["gift", "celebration", "festival", "event"],
  },
  {
    icon: "tada.svg",
    category: "festivals",
    label: "Celebrate",
    tags: ["celebrate", "event", "success", "festival"],
  },
  {
    icon: "school.svg",
    category: "productivity",
    label: "School",
    tags: ["school", "study", "exam", "students"],
  },
  {
    icon: "location.svg",
    category: "essentials",
    label: "Location",
    tags: ["map", "city", "travel", "address"],
  },
  {
    icon: "people.svg",
    category: "essentials",
    label: "People",
    tags: ["community", "team", "family", "group"],
  },
  {
    icon: "leaf.svg",
    category: "fun",
    label: "Nature",
    tags: ["nature", "green", "eco", "outdoors"],
  },
]);

const VALID_CATEGORIES = new Set([
  "all",
  "essentials",
  "productivity",
  "festivals",
  "fun",
]);

const ALLOWED_SVG_ICON_NAMES = new Set(INDIA_SVG_LIBRARY.map(item => item.icon));
const ALLOWED_EMOJIS = new Set(INDIA_EMOJI_LIBRARY.map(item => item.emoji));

class nsZenEmojiPicker extends nsZenDOMOperatedFeature {
  #panel;

  #anchor;
  #emojiAsSVG = false;
  #closeOnSelect = true;
  #onSelect = null;
  #hasSelection = false;
  #lastSelectedEmoji = null;
  #selectedCategory = "all";

  #currentPromise = null;
  #currentPromiseResolve = null;
  #currentPromiseReject = null;

  init() {
    this.#panel = document.getElementById("PanelUI-zen-emojis-picker");
    this.#panel.addEventListener("popupshowing", this);
    this.#panel.addEventListener("popuphidden", this);
    this.#panel.addEventListener("command", this);
    this.searchInput.addEventListener("input", this);
  }

  handleEvent(event) {
    switch (event.type) {
      case "popupshowing":
        this.#onPopupShowing(event);
        break;
      case "popuphidden":
        this.#onPopupHidden(event);
        break;
      case "command":
        if (event.target.id === "PanelUI-zen-emojis-picker-none") {
          this.#selectEmoji(null);
        } else if (event.target.hasAttribute("data-zen-category")) {
          this.#changeCategory(event.target.getAttribute("data-zen-category"));
        } else if (
          event.target.id === "PanelUI-zen-emojis-picker-change-emojis"
        ) {
          this.#changePage(false);
        } else if (event.target.id === "PanelUI-zen-emojis-picker-change-svg") {
          this.#changePage(true);
        }
        break;
      case "input":
        this.#onSearchInput(event);
        break;
    }
  }

  get emojiList() {
    return document.getElementById("PanelUI-zen-emojis-picker-list");
  }

  get svgList() {
    return document.getElementById("PanelUI-zen-emojis-picker-svgs");
  }

  get searchInput() {
    return document.getElementById("PanelUI-zen-emojis-picker-search");
  }

  get categoryButtons() {
    return this.#panel.querySelectorAll(
      "#PanelUI-zen-emojis-picker-category-selector toolbarbutton"
    );
  }

  #changePage(toSvg = false) {
    const itemToScroll = toSvg
      ? this.svgList
      : document
          .getElementById("PanelUI-zen-emojis-picker-pages")
          .querySelector('[emojis="true"]');
    itemToScroll.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "start",
    });
    const button = document.getElementById(
      `PanelUI-zen-emojis-picker-change-${toSvg ? "svg" : "emojis"}`
    );
    const otherButton = document.getElementById(
      `PanelUI-zen-emojis-picker-change-${toSvg ? "emojis" : "svg"}`
    );
    button.classList.add("selected");
    otherButton.classList.remove("selected");
  }

  #changeCategory(category) {
    if (!VALID_CATEGORIES.has(category)) {
      category = "all";
    }
    this.#selectedCategory = category;
    for (const button of this.categoryButtons) {
      button.classList.toggle(
        "selected",
        button.getAttribute("data-zen-category") === category
      );
    }
    this.#applyFilters();
  }

  #setAllowNone(allowNone) {
    if (allowNone) {
      this.#panel.removeAttribute("hide-none-option");
      return;
    }
    this.#panel.setAttribute("hide-none-option", "true");
  }

  #onSearchInput(event) {
    if (!event.target) {
      return;
    }
    this.#applyFilters();
  }

  #matchesSearch(query, tags, label) {
    if (!query) {
      return true;
    }
    const normalizedLabel = String(label || "").toLowerCase();
    if (normalizedLabel.includes(query)) {
      return true;
    }
    return tags.some(tag => tag.includes(query));
  }

  #matchesCategory(category) {
    return this.#selectedCategory === "all" || category === this.#selectedCategory;
  }

  #applyFilters() {
    const query = this.searchInput.value.trim().toLowerCase();

    for (const button of this.emojiList.children) {
      const category = button.getAttribute("zen-category");
      const tags = (button.getAttribute("zen-tags") || "")
        .split(",")
        .map(tag => tag.trim().toLowerCase())
        .filter(Boolean);
      const label = button.getAttribute("label");
      button.hidden =
        !this.#matchesCategory(category) ||
        !this.#matchesSearch(query, tags, label);
    }

    for (const button of this.svgList.children) {
      const category = button.getAttribute("zen-category");
      const tags = (button.getAttribute("zen-tags") || "")
        .split(",")
        .map(tag => tag.trim().toLowerCase())
        .filter(Boolean);
      const iconLabel =
        button.getAttribute("zen-icon-label") || button.getAttribute("icon");
      button.hidden =
        !this.#matchesCategory(category) ||
        !this.#matchesSearch(query, tags, iconLabel);
    }
  }

  #clearButtons() {
    this.emojiList.innerHTML = "";
    this.svgList.innerHTML = "";
    this.searchInput.value = "";
    this.#changeCategory("all");
  }

  isValidWorkspaceIcon(icon) {
    if (!icon) {
      return true;
    }
    if (icon.startsWith("chrome://browser/skin/zen-icons/selectable/")) {
      const iconName = icon.split("/").pop();
      return ALLOWED_SVG_ICON_NAMES.has(iconName);
    }
    return ALLOWED_EMOJIS.has(icon);
  }

  sanitizeWorkspaceIcon(icon) {
    return this.isValidWorkspaceIcon(icon) ? icon : "";
  }

  // note: It's async on purpose so we can render the popup before processing the emojis
  async #onPopupShowing(event) {
    if (event.target !== this.#panel) {
      return;
    }
    this.#clearButtons();
    const allowEmojis = !this.#panel.hasAttribute("only-svg-icons");
    if (allowEmojis) {
      const emojiList = this.emojiList;
      for (const emoji of INDIA_EMOJI_LIBRARY) {
        const item = document.createXULElement("toolbarbutton");
        item.className = "toolbarbutton-1 zen-emojis-picker-emoji";
        item.setAttribute("label", emoji.emoji);
        item.setAttribute("zen-category", emoji.category);
        item.setAttribute("zen-tags", emoji.tags.join(","));
        item.style.order = emoji.order;
        item.setAttribute("tooltiptext", "");
        item.addEventListener("command", () => {
          this.#selectEmoji(emoji.emoji);
        });
        emojiList.appendChild(item);
      }
      setTimeout(() => {
        this.searchInput.focus();
      }, 500);
    }
    const svgList = this.svgList;
    for (const icon of INDIA_SVG_LIBRARY) {
      const item = document.createXULElement("toolbarbutton");
      item.className = "toolbarbutton-1 zen-emojis-picker-svg";
      item.setAttribute("label", icon.icon);
      item.setAttribute("tooltiptext", "");
      item.style.listStyleImage = `url(${this.getSVGURL(icon.icon)})`;
      item.setAttribute("icon", icon.icon);
      item.setAttribute("zen-icon-label", icon.label);
      item.setAttribute("zen-category", icon.category);
      item.setAttribute("zen-tags", icon.tags.join(","));
      item.addEventListener("command", () => {
        this.#selectEmoji(this.getSVGURL(icon.icon));
      });
      svgList.appendChild(item);
    }
    this.#applyFilters();
  }

  #onPopupHidden(event) {
    if (event.target !== this.#panel) {
      return;
    }
    this.#changePage(false);
    this.#clearButtons();

    if (!this.#hasSelection) {
      this.#currentPromiseReject?.(
        new Error("Emoji picker closed without selection")
      );
    } else if (!this.#closeOnSelect) {
      this.#currentPromiseResolve?.(this.#lastSelectedEmoji);
    }

    this.#currentPromise = null;
    this.#currentPromiseResolve = null;
    this.#currentPromiseReject = null;
    this.#onSelect = null;
    this.#closeOnSelect = true;
    this.#hasSelection = false;
    this.#lastSelectedEmoji = null;

    this.#anchor.removeAttribute("zen-emoji-open");
    this.#anchor.parentElement.removeAttribute("zen-emoji-open");
    this.#anchor = null;
  }

  #selectEmoji(emoji) {
    if (this.#emojiAsSVG && emoji && !emoji.startsWith("chrome://")) {
      emoji = `data:image/svg+xml;base64,${btoa(
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><text y="28" font-size="28" x="0">${unescape(
          encodeURIComponent(emoji)
        )}</text></svg>`
      )}`;
    }
    this.#setAllowNone(Boolean(emoji));
    this.#hasSelection = true;
    this.#lastSelectedEmoji = emoji;
    this.#onSelect?.(emoji);
    if (!this.#closeOnSelect) {
      return;
    }
    this.#currentPromiseResolve?.(emoji);
    this.#panel.hidePopup();
  }

  open(
    anchor,
    {
      onlySvgIcons = false,
      emojiAsSVG = false,
      allowNone = true,
      closeOnSelect = true,
      onSelect = null,
    } = {}
  ) {
    if (this.#currentPromise) {
      return null;
    }
    this.#emojiAsSVG = emojiAsSVG;
    this.#closeOnSelect = closeOnSelect;
    this.#onSelect = onSelect;
    this.#hasSelection = false;
    this.#lastSelectedEmoji = null;
    this.#currentPromise = new Promise((resolve, reject) => {
      this.#currentPromiseResolve = resolve;
      this.#currentPromiseReject = reject;
    });
    this.#anchor = anchor;
    this.#anchor.setAttribute("zen-emoji-open", "true");
    this.#anchor.parentElement.setAttribute("zen-emoji-open", "true");
    if (onlySvgIcons) {
      this.#panel.setAttribute("only-svg-icons", "true");
    } else {
      this.#panel.removeAttribute("only-svg-icons");
    }
    this.#setAllowNone(allowNone);
    this.#panel.openPopup(anchor, "after_start", 0, 0, false, false);
    return this.#currentPromise;
  }

  getSVGURL(icon) {
    return `chrome://browser/skin/zen-icons/selectable/${icon}`;
  }
}

window.gZenEmojiPicker = new nsZenEmojiPicker();
