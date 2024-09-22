// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

var gZenNewWebPanel = {
  init: function () {
    document.addEventListener('dialogaccept', this.handleDialogAccept.bind(this));
  },

  handleURLChange: async function (aURL) {
    try {
      let url = new URL(aURL.value);
    } catch (_) {
      // TODO: Show error message
      return;
    }
  },

  addHttpIfMissing(url) {
    // List of schemes to avoid
    const avoidSchemes = ['about:', 'chrome:', 'moz-extension:', 'view-source:'];
    // Check if the URL starts with any of the avoid schemes
    for (let scheme of avoidSchemes) {
      if (url.startsWith(scheme)) {
        return url;
      }
    }
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return 'https://' + url;
    }
    return url;
  },

  handleDialogAccept: async function (aEvent) {
    document.commandDispatcher.focusedElement?.blur();
    let url = document.getElementById('zenNWP_url');
    let ua = document.getElementById('zenNWP_userAgent'); // checbkox
    if (!url || !ua) {
      return;
    }
    let urlValue = url.value;
    try {
      new URL(urlValue);
    } catch (_) {
      urlValue = this.addHttpIfMissing(url.value);
    }
    if (!url.value) {
      return;
    }
    let newSite = {
      url: urlValue,
      ua: ua.checked,
    };
    let currentData = JSON.parse(Services.prefs.getStringPref('zen.sidebar.data'));
    let newName = 'p' + new Date().getTime();
    currentData.index.push(newName);
    currentData.data[newName] = newSite;
    Services.prefs.setStringPref('zen.sidebar.data', JSON.stringify(currentData));
  },
};

gZenNewWebPanel.init();
