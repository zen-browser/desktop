
var ZenWorkspaces = {
  async init() {
    await this.initializeWorkspaces();
    console.log("ZenWorkspaces initialized");
  },

  get workspaceEnabled() {
    return Services.prefs.getBoolPref("zen.workspaces.enabled", false);
  },

  // Wrorkspaces saving/loading
  get _storeFile() {
    return PathUtils.join(
      PathUtils.profileDir,
      "zen-workspaces",
      "Workspaces.json",
    );
  },

  async initializeWorkspaces() {
    let file = new FileUtils.File(this._storeFile);
    if (!file.exists()) {
      await IOUtils.writeJSON(this._storeFile, {});
    }
  },

  async saveWorkspace(workspaceData, windowID) {
    let json = await IOUtils.readJSON(this._storeFile);
    json[windowID] = workspaceData;
    await IOUtils.writeJSON(this._storeFile, json);
  },

  async loadWorkspace(windowID) {
    let json = await IOUtils.readJSON(this._storeFile);
    return json[windowID];
  },

  async removeWorkspace(windowID) {
    let json = await IOUtils.readJSON(this._storeFile);
    delete json[windowID];
    await IOUtils.writeJSON(this._storeFile, json);
  },

  async getWorkspaces() {
    let json = await IOUtils.readJSON(this._storeFile);
    return json;
  },

  async getWorkspace(windowID) {
    let json = await IOUtils.readJSON(this._storeFile);
    return json[windowID];
  },

  // Workspaces management

  _createWorkspaceData(windowID) {
    let window = Services.wm.getOuterWindowWithId(windowID);
    let tabs = Array.from(window.gBrowser.tabs).map(tab => ({
      url: tab.linkedBrowser.currentURI.spec,
      title: tab.label,
    }));
    return {
      tabs,
    };
  },

  async saveCurrentWorkspace(windowID) {
    let workspaceData = this._createWorkspaceData(windowID);
    await this.saveWorkspace(workspaceData, windowID);
  },
};

ZenWorkspaces.init();
