
const kZenColors = [
  "#aac7ff",
  "#74d7cb",
  "#a0d490",
  "#dec663",
  "#ffb787",
  "#dec1b1",
  "#ffb1c0",
  "#ddbfc3",
  "#f6b0ea",
  "#d4bbff",
];

var gZenLooksAndFeel = {
  init() {
    this._initializeColorPicker(this._getInitialAccentColor());
    window.zenPageAccentColorChanged = this._handleAccentColorChange.bind(this);
  },

  _initializeColorPicker(accentColor) {
    let elem = document.getElementById("zenLooksAndFeelColorOptions");
    elem.innerHTML = "";
    for (let color of kZenColors) {
      let colorElemParen = document.createElement("div");
      let colorElem = document.createElement("div");
      colorElemParen.classList.add("zenLooksAndFeelColorOptionParen");
      colorElem.classList.add("zenLooksAndFeelColorOption");
      colorElem.style.setProperty("--zen-primary-color", color, "important");
      if (accentColor === color) {
        colorElemParen.setAttribute("selected", "true");
      }
      colorElemParen.addEventListener("click", () => {
        Services.prefs.setStringPref("zen.theme.accent-color", color);
      });
      colorElemParen.appendChild(colorElem);
      elem.appendChild(colorElemParen);
    }
    // TODO: add custom color selection!
  },

  _handleAccentColorChange(accentColor) {
    this._initializeColorPicker(accentColor);
  },

  _getInitialAccentColor() {
    return Services.prefs.getStringPref("zen.theme.accent-color", kZenColors[0]);
  },
};
