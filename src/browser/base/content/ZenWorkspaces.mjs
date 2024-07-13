
var ZenWorkspaces = {
  async init() {
    console.log("Initializing ZenWorkspaces...");
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

  async _workspaces() {
    if (!this._workspaceCache) {
      this._workspaceCache = await IOUtils.readJSON(this._storeFile);
      if (!this._workspaceCache.workspaces) {
        this._workspaceCache.workspaces = [];
      }
    }
    return this._workspaceCache;
  },

  onWorkspacesEnabledChanged() {
    if (this.workspaceEnabled) {
      this.initializeWorkspaces();
    } else {
      this._workspaceCache = null;
      document.getElementById("zen-workspaces-button")?.remove();
      for (let tab of gBrowser.tabs) {
        gBrowser.showTab(tab);
      }
    }
  },

  async initializeWorkspaces() {
    Services.prefs.addObserver("zen.workspaces.enabled", this.onWorkspacesEnabledChanged.bind(this));
    this.initializeWorkspacesButton();
    let file = new FileUtils.File(this._storeFile);
    if (!file.exists()) {
      await IOUtils.writeJSON(this._storeFile, {});
    }
    if (this.workspaceEnabled) {
      let workspaces = await this._workspaces();
      console.log("Workspaces loaded", workspaces);
      if (workspaces.workspaces.length === 0) {
        await this.createAndSaveWorkspace("Default Workspace");
      } else {
        let activeWorkspace = workspaces.workspaces.find(workspace => workspace.used);
        if (!activeWorkspace) {
          activeWorkspace = workspaces.workspaces.find(workspace => workspace.default);
          activeWorkspace.used = true;
          await this.saveWorkspaces();
        }
        if (!activeWorkspace) {
          activeWorkspace = workspaces.workspaces[0];
          activeWorkspace.used = true;
          await this.saveWorkspaces();
        }
        await this.changeWorkspace(activeWorkspace);
      }
    }
  },

  async saveWorkspace(workspaceData) {
    let json = await IOUtils.readJSON(this._storeFile);
    if (typeof json.workspaces === "undefined") {
      json.workspaces = [];
    }
    json.workspaces.push(workspaceData);
    console.log("Saving workspace", workspaceData);
    await IOUtils.writeJSON(this._storeFile, json);
    this._workspaceCache = null;
  },

  async removeWorkspace(windowID) {
    let json = await IOUtils.readJSON(this._storeFile);
    if (!json.workspaces) {
      return;
    }
    json.workspaces = json.workspaces.filter(workspace => workspace.uuid !== windowID);
    await IOUtils.writeJSON(this._storeFile, json);
  },

  async saveWorkspaces() {
    await IOUtils.writeJSON(this._storeFile, await this._workspaces());
    this._workspaceCache = null;
  },

  async unsafeSaveWorkspaces(workspaces) {
    await IOUtils.writeJSON(this._storeFile, workspaces);
    this._workspaceCache = null;
  },

  // Workspaces dialog UI management

  openSaveDialog() {
    let parentPanel = document.getElementById("PanelUI-zen-workspaces-multiview");
    PanelUI.showSubView("PanelUI-zen-workspaces-create", parentPanel);
  },

  cancelWorkspaceCreation() {
    let parentPanel = document.getElementById("PanelUI-zen-workspaces-multiview");
    parentPanel.goBack();
  },

  async _propagateWorkspaceData() {
    let currentContainer = document.getElementById("PanelUI-zen-workspaces-current-info");
    let workspaceList = document.getElementById("PanelUI-zen-workspaces-list");
    const createWorkspaceElement = (workspace) => {
      let element = document.createElement("toolbarbutton");
      element.className = "subviewbutton";
      element.setAttribute("tooltiptext", workspace.name);
      element.setAttribute("zen-workspace-id", workspace.uuid);
      element.innerHTML = `
        <div class="zen-workspace-icon">
          ${workspace.name[0].toUpperCase()}
        </div>
        <div class="zen-workspace-name">
          ${workspace.name}
        </div>
      `;
      element.onclick = (async () => {
        await this.changeWorkspace(workspace)
        let panel = document.getElementById("PanelUI-zen-workspaces");
        PanelMultiView.hidePopup(panel);
      }).bind(this, workspace);
      return element;
    }
    let workspaces = await this._workspaces();
    let activeWorkspace = workspaces.workspaces.find(workspace => workspace.used);
    currentContainer.innerHTML = "";
    workspaceList.innerHTML = "";
    workspaceList.parentNode.style.display = "flex";
    if (workspaces.workspaces.length - 1 <= 0) {
      workspaceList.parentNode.style.display = "none";
    }      
    if (activeWorkspace) {
      let currentWorkspace = createWorkspaceElement(activeWorkspace);
      currentContainer.appendChild(currentWorkspace);
    }
    for (let workspace of workspaces.workspaces) {
      if (workspace.used) {
        continue;
      }
      let workspaceElement = createWorkspaceElement(workspace);
      workspaceList.appendChild(workspaceElement);
    }
  },

  async openWorkspacesDialog(event) {
    if (!this.workspaceEnabled) {
      return;
    }
    let target = event.target;
    let panel = document.getElementById("PanelUI-zen-workspaces");
    await this._propagateWorkspaceData();
    PanelMultiView.openPopup(panel, target, {
      position: "bottomright topright",
      triggerEvent: event,
    }).catch(console.error);
  },

  initializeWorkspacesButton() {
    if (!this.workspaceEnabled) {
      return;
    } else if (document.getElementById("zen-workspaces-button")) {
      let button = document.getElementById("zen-workspaces-button");
      button.removeAttribute("hidden");
      return;
    }
    let browserTabs = document.getElementById("tabbrowser-tabs");
    let button = document.createElement("toolbarbutton");
    button.id = "zen-workspaces-button";
    button.className = "toolbarbutton-1 chromeclass-toolbar-additional";
    button.setAttribute("label", "Workspaces");
    button.setAttribute("tooltiptext", "Workspaces");
    button.onclick = this.openWorkspacesDialog.bind(this);
    browserTabs.insertAdjacentElement("beforebegin", button);
  },

  async _updateWorkspacesButton() {
    let button = document.getElementById("zen-workspaces-button");
    if (!button) {
      return;
    }
    let activeWorkspace = (await this._workspaces()).workspaces.find(workspace => workspace.used);
    if (activeWorkspace) {
      button.innerHTML = activeWorkspace.name[0].toUpperCase();
    }
  },

  // Workspaces management

  get _workspaceInput() {
    return document.getElementById("PanelUI-zen-workspaces-create-input");
  },

  _prepareNewWorkspace(window) {
    document.documentElement.setAttribute("zen-workspace-id", window.uuid);
    this._createNewTabForWorkspace(window);
  },

  _createNewTabForWorkspace(window) {
    let tab = gZenUIManager.openAndChangeToTab(Services.prefs.getStringPref("browser.startup.homepage"));
    tab.setAttribute("zen-workspace-id", window.uuid);
  },

  async saveWorkspaceFromInput() {
    let workspaceName = this._workspaceInput.value;
    if (!workspaceName) {
      return;
    }
    this._workspaceInput.value = "";
    await this.createAndSaveWorkspace(workspaceName);
    document.getElementById("PanelUI-zen-workspaces").hidePopup(true);
  },

  onWorkspaceNameChange(event) {
    let button = document.getElementById("PanelUI-zen-workspaces-create-save");
    if (this._workspaceInput.value === "") {
      button.setAttribute("disabled", "true");
      return;
    }
    button.removeAttribute("disabled");
  },

  async changeWorkspace(window) {
    if (!this.workspaceEnabled) {
      return;
    }
    let firstTab = undefined;
    // Get the number of tabs that are hidden before we start hiding them
    let numHiddenTabs = gBrowser.tabs.reduce((acc, tab) => {
      return tab.getAttribute("zen-workspace-id") !== window.uuid ? acc + 1 : acc;
    }, 0);
    let workspaces = await this._workspaces();
    for (let workspace of workspaces.workspaces) {
      workspace.used = workspace.uuid === window.uuid;
    }
    this.unsafeSaveWorkspaces(workspaces);
    if (numHiddenTabs === gBrowser.tabs.length) {
      // If all tabs are hidden, we need to create a new tab
      // to show the workspace
      this._createNewTabForWorkspace(window);
    }
    for (let tab of gBrowser.tabs) {
      if (tab.getAttribute("zen-workspace-id") === window.uuid) {
        if (!firstTab) {
          firstTab = tab;
          gBrowser.selectedTab = firstTab;
        }
        gBrowser.showTab(tab);
      }
    }
    for (let tab of gBrowser.tabs) {
      if (tab.getAttribute("zen-workspace-id") !== window.uuid) {
        gBrowser.hideTab(tab);
      }
    }
    document.documentElement.setAttribute("zen-workspace-id", window.uuid);
    await this.saveWorkspaces();
    await this._updateWorkspacesButton();
    await this._propagateWorkspaceData();
  },

  _createWorkspaceData(name) {
    let window = {
      uuid: gZenUIManager.generateUuidv4(),
      default: false,
      used: true,
      icon: "",
      name: name,
    };
    this._prepareNewWorkspace(window);
    return window;
  },

  async createAndSaveWorkspace(name = "New Workspace") {
    if (!this.workspaceEnabled) {
      return;
    }
    let workspaceData = this._createWorkspaceData(name);
    await this.saveWorkspace(workspaceData);
    await this.changeWorkspace(workspaceData);
  },

  async onLocationChange(browser) {
    let tab = gBrowser.getTabForBrowser(browser);
    let workspaceID = tab.getAttribute("zen-workspace-id");
    if (!workspaceID) {
      let workspaces = await this._workspaces();
      let activeWorkspace = workspaces.workspaces.find(workspace => workspace.used);
      if (!activeWorkspace) {
        return;
      }
      tab.setAttribute("zen-workspace-id", activeWorkspace.uuid);
    }
  },
};

ZenWorkspaces.init();
