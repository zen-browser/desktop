
var gZenNewWebPanel = {
  init: function() {
    document.addEventListener("dialogaccept", this.handleDialogAccept.bind(this));
  },

  handleURLChange: async function(aURL) {
    try {
      let url = new URL(aURL.value);
    } catch (_) {
      // TODO: Show error message
      return;
    }
  },

  handleDialogAccept: async function(aEvent) {
    document.commandDispatcher.focusedElement?.blur();
    let url = document.getElementById("zenNWP_url");
    let ua = document.getElementById("zenNWP_userAgent");
    if (!url || !ua) {
      return;
    }
    try {
      new URL(url.value);
    } catch (_) {
      return;
    }
    if (!url.value || !ua.value) {
      return;
    }
    let newSite = {
      url: url.value,
      ua: ua.value,
    };
    let currentData = JSON.parse(Services.prefs.getStringPref("zen.sidebar.data"));
    let newName = "p" + new Date().getTime();
    currentData.index.push(newName);
    currentData.data[newName] = newSite;
    Services.prefs.setStringPref("zen.sidebar.data", JSON.stringify(currentData));
  },
};

gZenNewWebPanel.init();