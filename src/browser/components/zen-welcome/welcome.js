// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.
const { XPCOMUtils } = ChromeUtils.import(
  'resource://gre/modules/XPCOMUtils.jsm'
)

XPCOMUtils.defineLazyModuleGetters(this, {
  AddonManager: 'resource://gre/modules/AddonManager.jsm',
  MigrationUtils: 'resource:///modules/MigrationUtils.jsm',
})

ChromeUtils.defineModuleGetter(
  this,
  'ExtensionSettingsStore',
  'resource://gre/modules/ExtensionSettingsStore.jsm'
);

Services.scriptloader.loadSubScript("chrome://browser/content/ZenUIManager.mjs");

const kWelcomeURL = 'https://get-zen.vercel.app/welcome';
const kWelcomeSeenPref = 'zen.welcomeScreen.seen'

// =============================================================================
// Util stuff copied from browser/components/preferences/search.js

class EngineStore {
  constructor() {
    this._engines = []
  }

  async init() {
    const visibleEngines = await Services.search.getVisibleEngines()
    this.initSpecificEngine(visibleEngines)
  }

  getEngine() {
    return this._engines
  }

  initSpecificEngine(engines) {
    for (const engine of engines) {
      try {
        this._engines.push(this._cloneEngine(engine))
      } catch (e) {
        // Ignore engines that throw an exception when cloning.
        console.error(e)
      }
    }
  }

  getEngineByName(name) {
    return this._engines.find((engine) => engine.name == name)
  }

  _cloneEngine(aEngine) {
    const clonedObj = {}

    for (const i of ['name', 'alias', '_iconURI', 'hidden']) {
      clonedObj[i] = aEngine[i]
    }

    clonedObj.originalEngine = aEngine

    return clonedObj
  }

  async getDefaultEngine() {
    let engineName = await Services.search.getDefault()
    return this.getEngineByName(engineName._name)
  }

  async setDefaultEngine(engine) {
    await Services.search.setDefault(
      engine.originalEngine,
      Ci.nsISearchService.CHANGE_REASON_USER
    )
  }
}

// =============================================================================

const sleep = (duration) =>
  new Promise((resolve) => setTimeout(resolve, duration))

class Page {
  /**
   * A basic controller for individual pages
   * @param {string} id The id of the element that represents this page.
   */
  constructor(id) {
    this.element = document.getElementById(id)
    this.nextEl = document.getElementById(`${id}Next`)

    this.nextEl.addEventListener('click', () => {
      this.pages.next()
    })
  }

  /**
   *
   * @param {Pages} pages The pages wrapper
   */
  setPages(pages) {
    this.pages = pages
  }

  hide() {
    this.element.setAttribute('hidden', 'true')
  }

  show() {
    this.element.removeAttribute('hidden')
  }
}

class Themes extends Page {
  constructor(id) {
    super(id)

    this.loadThemes()
  }

  async loadThemes() {
    window.addEventListener('DOMContentLoaded', this.setColorBar);
    await sleep(1000)

    const themes = (await AddonManager.getAddonsByTypes(['theme'])).filter(
      (theme) => theme.id !== "default-theme@mozilla.org"
    )
    const themeList = document.getElementById('themeList');

    const themeElements = []

    themes.forEach((theme) => {
      const container = document.createElement('div')
      container.classList.add('card');
      container.classList.add('card-no-hover');

      //if (theme.id == "firefox-compact-dream@mozilla.org" || theme.id == "firefox-compact-galaxy@mozilla.org") {
      //  container.setAttribute('disabled', 'true')
      //}

      if (theme.isActive) {
        container.classList.add('selected')
      }

      container.addEventListener('click', () => {
        if (container.hasAttribute('disabled')) {
          return
        }
        document.body.classList.add('normal-background');
        themeElements.forEach((el) => el.classList.remove('selected'))
        container.classList.add('selected')
        theme.enable()
      })

      const img = document.createElement('img')
      img.src = theme.icons['32']

      const name = document.createElement('h3')
      name.textContent = theme.name

      //container.appendChild(img)
      container.appendChild(name)

      themeList.appendChild(container)
      themeElements.push(container)
    })
  }

  setColorBar() {
    const colorList = document.getElementById('colorList');
    const ctx = colorList.getContext('2d');
    let gradient = ctx.createLinearGradient(0, 0, 500, 20);
    colorList.width = 500;
    colorList.height = 20; 

    gradient.addColorStop(0.1, '#aac7ff');
    gradient.addColorStop(0.2, '#74d7cb');
    gradient.addColorStop(0.3, '#a0d490');
    gradient.addColorStop(0.4, '#dec663');
    gradient.addColorStop(0.5, '#ffb787');
    gradient.addColorStop(0.6, '#ffb1c0');
    gradient.addColorStop(0.7, '#ddbfc3');
    gradient.addColorStop(0.8, '#f6b0ea');
    gradient.addColorStop(0.9, '#d4bbff');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 1000, 150);

    const dragBall = document.getElementById('dragBall');
    dragBall.style.left = `17px`;
    dragBall.addEventListener('mousedown', (e) => {
      const rect = colorList.getBoundingClientRect();
      e.preventDefault();
      
      const onMouseMove = (ev) => {
        var x = ev.clientX - rect.left;
        dragBall.style.left = `${x - 17/2}px`;
        if (x < 17) {
          dragBall.style.left = `${17/2}px`;
          x = 17;
        } else if (x > rect.width - 17) {
          dragBall.style.left = `${rect.width - 17 - (17/2)}px`;
          x = rect.width - 17 - (17/2);
        }  
        const data = ctx.getImageData(x - 17, 1, 1, 1).data;
        let color = `#${data[0].toString(16)}${data[1].toString(16)}${data[2].toString(16)}`;
        document.getElementById("colorPreview").style.backgroundColor = color;
        Services.prefs.setStringPref('zen.theme.accent-color', color);
      }

      const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        document.getElementById("colorPreview").style.backgroundColor = '';
      }
      
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });
  }
}

class Thanks extends Page {
  constructor(id) {
    super(id)

    // Thanks :)
  }
}

class Search extends Page {
  constructor(id) {
    super(id)

    this.store = new EngineStore()
    this.searchList = []

    this.loadSearch()
  }

  async loadSearch() {
    await sleep(1100)
    await this.store.init()

    const defaultEngine = await Services.search.getDefault()

    const searchElements = document.getElementById('searchList')

    this.store.getEngine().forEach(async (search) => {
      const container = await this.loadSpecificSearch(search, defaultEngine)

      searchElements.appendChild(container)
      this.searchList.push(container)
    })
  }

  /**
   * @returns {HTMLDivElement}
   */
  async loadSpecificSearch(search, defaultSearch) {
    const container = document.createElement('div');
    container.classList.add('card')
    container.classList.add('card-no-hover')

    if (search.name == defaultSearch._name) {
      container.classList.add('selected')
    }

    container.addEventListener('click', () => {
      this.searchList.forEach((el) => el.classList.remove('selected'))
      container.classList.add('selected')
      this.store.setDefaultEngine(search)
    })

    const img = document.createElement('img');
    img.src = await search.originalEngine.getIconURL();

    const name = document.createElement('h3')
    name.textContent = search.name

    container.appendChild(img)
    container.appendChild(name)

    return container
  }
}

class Import extends Page {
  constructor(id) {
    super(id)

    const importButton = document.getElementById('importBrowser')
    importButton.addEventListener('click', async () => {
      MigrationUtils.showMigrationWizard(window, {
        zenBlocking: true,
      });
      this.nextEl.click()
    })
  }
}

class Pages {
  /**
   * A wrapper around all pages
   * @param {Page[]} pages The pages
   */
  constructor(pages) {
    console.log("Initializing welcome pages...");
    this.pages = pages
    this.currentPage = 0;

    window.maximize();  

    this.pages.forEach((page) => page.setPages(this))

    const dots = document.getElementById("dots");
    for (let i = 0; i < this.pages.length; i++) {
      let dot = document.createElement("span");
      dot.classList.add("dot");
      dot.setAttribute("data-index", i);
      dot.onclick = (e) => {
        this.currentPage = parseInt(e.target.getAttribute("data-index"));
        this._displayCurrentPage();
      }
      dots.appendChild(dot);
    }
    this._displayCurrentPage();
    console.log("Welcome pages initialized.")
  }

  next() {
    this.currentPage++

    if (this.currentPage >= this.pages.length) {
      // We can use internal js apis to close the window. We also want to set
      // the settings api for welcome seen to false to stop it showing again

      Services.prefs.setBoolPref(kWelcomeSeenPref, true)

      close();
      this._openWelcomePage();
      return
    }

    this._displayCurrentPage()
  }

  _openWelcomePage() {
    gZenUIManager.openAndChangeToTab(kWelcomeURL);
  }

  _displayCurrentPage() {
    let dots = document.getElementsByClassName("dot");
    for (let i = 0; i < dots.length; i++) {
      dots[i].classList.remove("active");
    }
    dots[this.currentPage].classList.add("active");

    for (const page of this.pages) {
      page.hide()
    }

    this.pages[this.currentPage].show()
  }
}

const pages = new Pages([
  new Page('welcome'),
  new Themes('theme'),
  new Import('import'),
  new Search('search'),
  new Thanks('thanks'),
])
