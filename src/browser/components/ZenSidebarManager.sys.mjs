const { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");

export var ZenSidebarManager = {
  init() {
    this.update();
  },

  update() {
    let services = Services.prefs.getStringPref("zen.sidebar.data");
    if (services === "") {
      return;
    }
    let data = JSON.parse(services);
    if (!data.data || !data.index) {
      return;
    }
    console.log(data.data)
  },
};
