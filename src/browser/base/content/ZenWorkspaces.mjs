
var ZenWorkspaces = {
  async init() {
    let docElement = document.documentElement;
    if (docElement.getAttribute("chromehidden").includes("toolbar")
      || docElement.getAttribute("chromehidden").includes("menubar")) {
      console.log("!!! ZenWorkspaces is disabled in hidden windows !!!");
      return; // We are in a hidden window, don't initialize ZenWorkspaces
    }
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
        await this.createAndSaveWorkspace("Default Workspace", true);
      } else {
        let activeWorkspace = workspaces.workspaces.find(workspace => workspace.default);
        if (!activeWorkspace) {
          activeWorkspace = workspaces.workspaces.find(workspace => workspace.used);
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
    let json = await this._workspaces();
    await this.changeWorkspace(json.workspaces.find(workspace => workspace.uuid !== windowID));
    this._deleteAllTabsInWorkspace(windowID);
    json.workspaces = json.workspaces.filter(workspace => workspace.uuid !== windowID);
    await this.unsafeSaveWorkspaces(json);
    await this._propagateWorkspaceData();
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
      let element = document.createXULElement("toolbarbutton");
      element.className = "subviewbutton";
      element.setAttribute("tooltiptext", workspace.name);
      element.setAttribute("zen-workspace-id", workspace.uuid);
      element.setAttribute("context", "zenWorkspaceActionsMenu");
      let childs = window.MozXULElement.parseXULToFragment(`
        <div class="zen-workspace-icon">
          ${workspace.name[0].toUpperCase()}
        </div>
        <div class="zen-workspace-name">
          ${workspace.name}
        </div>
        <toolbarbutton closemenu="none" class="toolbarbutton-1 zen-workspace-actions">
          <image class="toolbarbutton-icon" id="zen-workspace-actions-menu-icon"></image>
        </toolbarbutton>
      `);
      childs.querySelector(".zen-workspace-actions").addEventListener("command", (event) => {
        let button = event.target;
        const popup = button.ownerDocument.getElementById(
          "zenWorkspaceActionsMenu"
        );
        popup.openPopup(button, "after_end");
      });
      element.appendChild(childs);
      element.onclick = (async () => {
        if (event.target.closest(".zen-workspace-actions")) {
          return; // Ignore clicks on the actions button
        }
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

  _deleteAllTabsInWorkspace(workspaceID) {
    for (let tab of gBrowser.tabs) {
      if (tab.getAttribute("zen-workspace-id") === workspaceID) {
        gBrowser.removeTab(tab);
      }
    }
  },

  _prepareNewWorkspace(window) {
    document.documentElement.setAttribute("zen-workspace-id", window.uuid);
    let tabCount = 0;
    for (let tab of gBrowser.tabs) {
      if (!tab.hasAttribute("zen-workspace-id")) {
        tab.setAttribute("zen-workspace-id", window.uuid);
        tabCount++;
      }
    }
    if (tabCount === 0) {
      this._createNewTabForWorkspace(window);
    }
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

  _createWorkspaceData(name, isDefault) {
    let window = {
      uuid: gZenUIManager.generateUuidv4(),
      default: isDefault,
      used: true,
      icon: "",
      name: name,
    };
    this._prepareNewWorkspace(window);
    return window;
  },

  async createAndSaveWorkspace(name = "New Workspace", isDefault = false) {
    if (!this.workspaceEnabled) {
      return;
    }
    let workspaceData = this._createWorkspaceData(name, isDefault);
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

  // Context menu management

  _contextMenuId: null,
  async updateContextMenu(event) {
    let target = event.target;
    let workspace = target.closest("[zen-workspace-id]");
    if (!workspace) {
      return;
    }
    _contextMenuId = workspace.getAttribute("zen-workspace-id");
    document.querySelector(`#PanelUI-zen-workspaces [zen-workspace-id="${_contextMenuId}"] .zen-workspace-actions`).setAttribute("active", "true");
    const workspaces = await this._workspaces();
    let deleteMenuItem = document.getElementById("context_zenDeleteWorkspace");
    if (workspaces.workspaces.length <= 1) {
      deleteMenuItem.setAttribute("disabled", "true");
    } else {
      deleteMenuItem.removeAttribute("disabled");
    }
  },

  onContextMenuClose() {
    let target = document.querySelector(`#PanelUI-zen-workspaces [zen-workspace-id="${_contextMenuId}"] .zen-workspace-actions`);
    if (target) {
      target.removeAttribute("active");
    }
    this._contextMenuId = null;
  },

  async contextDelete() {
    await this.removeWorkspace(_contextMenuId);
  }
};

ZenWorkspaces.init();
