
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

  async saveWorkspace(workspaceData) {
    let json = await IOUtils.readJSON(this._storeFile);
    if (!json.workspaces) {
      json.workspaces = [];
    }
    json.workspaces.push(workspaceData);
    console.log("Saving workspace", workspaceData);
    await IOUtils.writeJSON(this._storeFile, json);
  },

  async loadWorkspace(windowID) {
    let json = await IOUtils.readJSON(this._storeFile);
    if (!json.workspaces) {
      return [];
    }
    return json.workspaces.filter(workspace => workspace.uuid === windowID);
  },

  async removeWorkspace(windowID) {
    let json = await IOUtils.readJSON(this._storeFile);
    if (!json.workspaces) {
      return;
    }
    json.workspaces = json.workspaces.filter(workspace => workspace.uuid !== windowID);
    await IOUtils.writeJSON(this._storeFile, json);
  },

  async getWorkspaces() {
    let json = await IOUtils.readJSON(this._storeFile);
    return json;
  },

  // Workspaces dialog UI management

  

  // Workspaces management

  _prepareNewWorkspace(window) {
    for (let tab of window.gBrowser.tabs) {
      tab.addAttribute("zen-workspace-id", window.uuid);
    }
    window.document.documentElement.setAttribute("zen-workspace-id", window.uuid);
  },

  _createWorkspaceData() {
    let window = {
      uuid: gZenUIManager.generateUuidv4(),
      default: false,
      icon: "",
      name: `New Workspace`,
    };
    this._prepareNewWorkspace(window);
    return window;
  },

  async createAndSaveWorkspace() {
    let workspaceData = this._createWorkspaceData();
    await this.saveWorkspace(workspaceData);
  },
};

ZenWorkspaces.init();
