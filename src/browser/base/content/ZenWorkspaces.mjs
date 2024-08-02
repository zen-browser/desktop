
var ZenWorkspaces = {
  async init() {
    let docElement = document.documentElement;
    if (docElement.getAttribute("chromehidden").includes("toolbar")
      || docElement.getAttribute("chromehidden").includes("menubar")
      || docElement.hasAttribute("privatebrowsingmode")) {
      console.warn("ZenWorkspaces: !!! ZenWorkspaces is disabled in hidden windows !!!");
      return; // We are in a hidden window, don't initialize ZenWorkspaces
    } 
    console.log("ZenWorkspaces: Initializing ZenWorkspaces...");
    await this.initializeWorkspaces();
    console.log("ZenWorkspaces: ZenWorkspaces initialized");
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
      this._initializeWorkspaceIcons();
    }
  },

  _initializeWorkspaceIcons() {
    const kIcons = ["🏠", "📄", "💹", "💼", "📧", "✅", "👥"];
    let container = document.getElementById("PanelUI-zen-workspaces-create-icons-container");
    for (let icon of kIcons) {
      let button = document.createXULElement("toolbarbutton");
      button.className = "toolbarbutton-1";
      button.setAttribute("label", icon);
      button.onclick = ((event) => {
        for (let button of container.children) {
          button.removeAttribute("selected");
        }
        button.setAttribute("selected", "true");
      }).bind(this, button);
      container.appendChild(button);
    }
  },

  async saveWorkspace(workspaceData) {
    let json = await IOUtils.readJSON(this._storeFile);
    if (typeof json.workspaces === "undefined") {
      json.workspaces = [];
    }
    json.workspaces.push(workspaceData);
    console.log("ZenWorkspaces: Saving workspace", workspaceData);
    await IOUtils.writeJSON(this._storeFile, json);
    this._workspaceCache = null;
  },

  async removeWorkspace(windowID) {
    let json = await this._workspaces();
    console.log("ZenWorkspaces: Removing workspace", windowID);
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

  workspaceHasIcon(workspace) {
    return typeof workspace.icon !== "undefined" && workspace.icon !== "";
  },

  getWorkspaceIcon(workspace) {
    if (this.workspaceHasIcon(workspace)) {
      return workspace.icon;
    }
    return workspace.name[0].toUpperCase();
  },

  async _propagateWorkspaceData() {
    let currentContainer = document.getElementById("PanelUI-zen-workspaces-current-info");
    let workspaceList = document.getElementById("PanelUI-zen-workspaces-list");
    const createWorkspaceElement = (workspace) => {
      let element = document.createXULElement("toolbarbutton");
      element.className = "subviewbutton";
      element.setAttribute("tooltiptext", workspace.name);
      element.setAttribute("zen-workspace-id", workspace.uuid);
      //element.setAttribute("context", "zenWorkspaceActionsMenu");
      let childs = window.MozXULElement.parseXULToFragment(`
        <div class="zen-workspace-icon">
          ${this.getWorkspaceIcon(workspace)}
        </div>
        <div class="zen-workspace-name">
          ${workspace.name}
        </div>
        <toolbarbutton closemenu="none" class="toolbarbutton-1 zen-workspace-actions">
          <image class="toolbarbutton-icon" id="zen-workspace-actions-menu-icon"></image>
        </toolbarbutton>
      `);
      childs.querySelector(".zen-workspace-actions").addEventListener("command", ((event) => {
        let button = event.target;
        this._contextMenuId = button.closest("toolbarbutton[zen-workspace-id]").getAttribute("zen-workspace-id");
        const popup = button.ownerDocument.getElementById(
          "zenWorkspaceActionsMenu"
        );
        popup.openPopup(button, "after_end");
      }).bind(this));
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
      workspaceList.innerHTML = "No workspaces available";
      workspaceList.setAttribute("empty", "true");
    } else {
      workspaceList.removeAttribute("empty");
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
      button.innerHTML = `
        <div class="zen-workspace-sidebar-icon">
          ${this.getWorkspaceIcon(activeWorkspace)}
        </div>
        <div class="zen-workspace-sidebar-name">
          ${activeWorkspace.name}
        </div>
      `;
      if (!this.workspaceHasIcon(activeWorkspace)) {
        button.querySelector(".zen-workspace-sidebar-icon").setAttribute("no-icon", "true");
      }
    }
  },

  // Workspaces management

  get _workspaceInput() {
    return document.getElementById("PanelUI-zen-workspaces-create-input");
  },

  _deleteAllTabsInWorkspace(workspaceID) {
    for (let tab of gBrowser.tabs) {
      if (tab.getAttribute("zen-workspace-id") === workspaceID) {
        gBrowser.removeTab(tab, {
          animate: true,
          skipSessionStore: true,
          closeWindowWithLastTab: false,
        });
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
    // Go to the next view
    let parentPanel = document.getElementById("PanelUI-zen-workspaces-multiview");
    PanelUI.showSubView("PanelUI-zen-workspaces-create-icons", parentPanel);
  },

  async saveWorkspaceFromIcon() {
    let workspaceName = this._workspaceInput.value;
    if (!workspaceName) {
      return;
    }
    this._workspaceInput.value = "";
    let icon = document.querySelector("#PanelUI-zen-workspaces-create-icons-container [selected]");
    icon?.removeAttribute("selected");
    await this.createAndSaveWorkspace(workspaceName, false, icon?.label);
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
    let workspaces = await this._workspaces();
    for (let workspace of workspaces.workspaces) {
      workspace.used = workspace.uuid === window.uuid;
    }
    this.unsafeSaveWorkspaces(workspaces);
    console.log("ZenWorkspaces: Changing workspace to", window.uuid);
    for (let tab of gBrowser.tabs) {
      if (tab.getAttribute("zen-workspace-id") === window.uuid && !tab.pinned) {
        if (!firstTab) {
          firstTab = tab;
          gBrowser.selectedTab = firstTab;
        }
        gBrowser.showTab(tab);
      }
    }
    if (typeof firstTab === "undefined") {
      this._createNewTabForWorkspace(window);
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

  _createWorkspaceData(name, isDefault, icon) {
    let window = {
      uuid: gZenUIManager.generateUuidv4(),
      default: isDefault,
      used: true,
      icon: icon,
      name: name,
    };
    this._prepareNewWorkspace(window);
    return window;
  },

  async createAndSaveWorkspace(name = "New Workspace", isDefault = false, icon = undefined) {
    if (!this.workspaceEnabled) {
      return;
    }
    let workspaceData = this._createWorkspaceData(name, isDefault, icon);
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
  async updateContextMenu(_) {
    console.assert(this._contextMenuId, "No context menu ID set");
    document.querySelector(`#PanelUI-zen-workspaces [zen-workspace-id="${this._contextMenuId}"] .zen-workspace-actions`).setAttribute("active", "true");
    const workspaces = await this._workspaces();
    let deleteMenuItem = document.getElementById("context_zenDeleteWorkspace");
    if (workspaces.workspaces.length <= 1 || workspaces.workspaces.find(workspace => workspace.uuid === this._contextMenuId).default) {
      deleteMenuItem.setAttribute("disabled", "true");
    } else {
      deleteMenuItem.removeAttribute("disabled");
    }
  },

  onContextMenuClose() {
    let target = document.querySelector(`#PanelUI-zen-workspaces [zen-workspace-id="${this._contextMenuId}"] .zen-workspace-actions`);
    if (target) {
      target.removeAttribute("active");
    }
    this._contextMenuId = null;
  },

  async contextDelete() {
    await this.removeWorkspace(this._contextMenuId);
  }
};

ZenWorkspaces.init();
