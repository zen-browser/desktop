/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

class TabGroup {
  constructor(title, permanent = false) {
    this.title = title;
    this.permanent = permanent;
    this.tabs = [];
  }

  addTab(tab) {
    this.tabs.push(tab);
  }

  removeTab(tab) {
    const index = this.tabs.indexOf(tab);
    if (index > -1) {
      this.tabs.splice(index, 1);
    }
  }

  isEmpty() {
    return this.tabs.length === 0;
  }
}

class TabGroupManager {
  constructor() {
    this.groups = [];
  }

  createGroup(title, permanent = false) {
    const group = new TabGroup(title, permanent);
    this.groups.push(group);
    return group;
  }

  removeGroup(group) {
    const index = this.groups.indexOf(group);
    if (index > -1) {
      this.groups.splice(index, 1);
    }
  }

  getGroupByTitle(title) {
    return this.groups.find(group => group.title === title);
  }

  getGroupByTab(tab) {
    return this.groups.find(group => group.tabs.includes(tab));
  }

  arrangeGroups(newOrder) {
    this.groups = newOrder;
  }
}

const tabGroupManager = new TabGroupManager();

class Tabbrowser {
  constructor() {
    this.tabs = [];
    this.selectedTab = null;
  }

  addTab(tab, groupTitle = null) {
    this.tabs.push(tab);
    if (groupTitle) {
      const group = tabGroupManager.getGroupByTitle(groupTitle);
      if (group) {
        group.addTab(tab);
      } else {
        const newGroup = tabGroupManager.createGroup(groupTitle);
        newGroup.addTab(tab);
      }
    }
  }

  removeTab(tab) {
    const group = tabGroupManager.getGroupByTab(tab);
    if (group) {
      group.removeTab(tab);
      if (group.isEmpty() && !group.permanent) {
        tabGroupManager.removeGroup(group);
      }
    }
    const index = this.tabs.indexOf(tab);
    if (index > -1) {
      this.tabs.splice(index, 1);
    }
  }

  createNewTab(groupTitle = null) {
    const newTab = {}; // Placeholder for actual tab creation logic
    this.addTab(newTab, groupTitle);
    return newTab;
  }

  pinTab(tab, groupTitle = null) {
    tab.pinned = true;
    if (groupTitle) {
      const group = tabGroupManager.getGroupByTitle(groupTitle);
      if (group) {
        group.addTab(tab);
      } else {
        const newGroup = tabGroupManager.createGroup(groupTitle);
        newGroup.addTab(tab);
      }
    }
  }

  unpinTab(tab) {
    tab.pinned = false;
    const group = tabGroupManager.getGroupByTab(tab);
    if (group) {
      group.removeTab(tab);
    }
  }

  arrangeGroups(newOrder) {
    tabGroupManager.arrangeGroups(newOrder);
  }
}

const tabbrowser = new Tabbrowser();
