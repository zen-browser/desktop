{
  function clearBrowserElements() {
    for (const element of document.getElementById('browser').children) {
      element.style.display = 'none';
    }
  }

  function getMotion() {
    return gZenUIManager.motion;
  }

  async function animate(...args) {
    return getMotion().animate(...args);
  }

  function initializeZenWelcome() {
    document.documentElement.setAttribute('zen-welcome-stage', 'true');
    const XUL = `
      <html:div id="zen-welcome">
        <html:div id="zen-welcome-start">
          <html:h1 class="zen-branding-title" id="zen-welcome-title"></html:h1>
          <button class="footer-button primary" id="zen-welcome-start-button">
          </button>
        </html:div>
        <hbox id="zen-welcome-pages">
          <vbox id="zen-welcome-page-sidebar">
            <vbox id="zen-welcome-page-sidebar-content">
            </vbox>
            <vbox id="zen-welcome-page-sidebar-buttons">
            </vbox>
          </vbox>
          <html:div id="zen-welcome-page-content">
          </html:div>
        </hbox>
      </html:div>
    `;
    const fragment = window.MozXULElement.parseXULToFragment(XUL);
    document.getElementById('browser').appendChild(fragment);
    window.MozXULElement.insertFTLIfNeeded('browser/zen-welcome.ftl');
  }

  class ZenWelcomePages {
    constructor(pages) {
      this._currentPage = -1;
      this._pages = pages;
      this.init();
      this.next();
    }

    init() {
      document.getElementById('zen-welcome-pages').style.display = 'flex';
      document.getElementById('zen-welcome-start').remove();
      window.maximize();
      animate('#zen-welcome-pages', { opacity: [0, 1] }, { delay: 0.1 });
    }

    async fadeInTitles(page) {
      const [title1, description1, description2] = await document.l10n.formatValues(page.text);
      const titleElement = document.getElementById('zen-welcome-page-sidebar-content');
      titleElement.innerHTML =
        `<html:h1>${title1}</html:h1><html:p>${description1}</html:p>` +
        (description2 ? `<html:p>${description2}</html:p>` : '');
      await animate(
        '#zen-welcome-page-sidebar-content > *',
        { x: ['150%', 0] },
        {
          delay: getMotion().stagger(0.05),
          type: 'spring',
          bounce: 0.2,
        }
      );
    }

    async fadeInButtons(page) {
      const buttons = document.getElementById('zen-welcome-page-sidebar-buttons');
      let i = 0;
      for (const button of page.buttons) {
        const buttonElement = document.createXULElement('button');
        document.l10n.setAttributes(buttonElement, button.l10n);
        if (i++ === 0) {
          buttonElement.classList.add('primary');
        }
        buttonElement.classList.add('footer-button');
        buttonElement.addEventListener('click', async () => {
          const shouldSkip = await button.onclick();
          if (shouldSkip) {
            this.next();
          }
        });
        buttons.appendChild(buttonElement);
      }
      await animate(
        '#zen-welcome-page-sidebar-buttons button',
        { x: ['150%', 0] },
        {
          delay: getMotion().stagger(0.1, { startDelay: 0.4 }),
          type: 'spring',
          bounce: 0.2,
        }
      );
    }

    async fadeInContent() {
      await animate(
        '#zen-welcome-page-content > *',
        { opacity: [0, 1] },
        {
          delay: getMotion().stagger(0.1),
          type: 'spring',
          bounce: 0.2,
        }
      );
    }

    async fadeOutButtons() {
      await animate(
        '#zen-welcome-page-sidebar-buttons button',
        { x: [0, '-150%'] },
        {
          type: 'spring',
          bounce: 0,
          delay: getMotion().stagger(0.1, { startDelay: 0.3 }),
        }
      );
      document.getElementById('zen-welcome-page-sidebar-buttons').innerHTML = '';
      document.getElementById('zen-welcome-page-sidebar-content').innerHTML = '';
    }

    async fadeOutTitles() {
      await animate(
        '#zen-welcome-page-sidebar-content > *',
        { x: [0, '-150%'] },
        {
          delay: getMotion().stagger(0.05, { startDelay: 0.3 }),
          type: 'spring',
          bounce: 0,
        }
      );
    }

    async fadeOutContent() {
      await animate(
        '#zen-welcome-page-content > *',
        { opacity: [1, 0] },
        {
          delay: getMotion().stagger(0.05, { startDelay: 0.3 }),
          type: 'spring',
          bounce: 0,
          duration: 0.2,
        }
      );
    }

    async next() {
      if (this._currentPage !== -1) {
        const previousPage = this._pages[this._currentPage];
        await Promise.all([this.fadeOutTitles(), this.fadeOutButtons(), this.fadeOutContent()]);
        await previousPage.fadeOut();
        document.getElementById('zen-welcome-page-content').innerHTML = '';
      }
      this._currentPage++;
      const currentPage = this._pages[this._currentPage];
      if (!currentPage) {
        this.finish();
        return;
      }
      await Promise.all([this.fadeInTitles(currentPage), this.fadeInButtons(currentPage)]);
      currentPage.fadeIn();
      await this.fadeInContent();
    }

    async finish() {
      await animate('#zen-welcome-page-content', { x: [0, '100%'] }, { bounce: 0 });
      document.getElementById('zen-welcome-page-content').remove();
      await this.animHeart();
      await animate('#zen-welcome-pages', { opacity: [1, 0] });
      document.getElementById('zen-welcome').remove();
      document.documentElement.removeAttribute('zen-welcome-stage');
      for (const element of document.getElementById('browser').children) {
        element.style.opacity = 0;
        element.style.removeProperty('display');
      }
      await animate('#browser > *', { opacity: [0, 1] });
      gZenUIManager.showToast('zen-welcome-finished');
    }

    async animHeart() {
      const heart = document.createElement('div');
      heart.id = 'zen-welcome-heart';
      const sidebar = document.getElementById('zen-welcome-page-sidebar');
      sidebar.style.width = '100%';
      sidebar.appendChild(heart);
      await animate(
        '#zen-welcome-heart',
        { opacity: [0, 1, 1, 1, 0], scale: [0.5, 1, 1.2, 1, 1.2] },
        {
          duration: 1.5,
          delay: 0.2,
          bounce: 0,
        }
      );
    }
  }

  function getWelcomePages() {
    return [
      {
        text: [
          {
            id: 'zen-welcome-import-title',
          },
          {
            id: 'zen-welcome-import-description-1',
          },
          {
            id: 'zen-welcome-import-description-2',
          },
        ],
        buttons: [
          {
            l10n: 'zen-welcome-import-button',
            onclick: async () => {
              MigrationUtils.showMigrationWizard(window, {
                isStartupMigration: true,
              });
              document.querySelector('#zen-welcome-page-sidebar-buttons button').remove();
              const newButton = document.querySelector('#zen-welcome-page-sidebar-buttons button');
              newButton.classList.add('primary');
              document.l10n.setAttributes(newButton, 'zen-welcome-next-action');
              return false;
            },
          },
          {
            l10n: 'zen-welcome-skip-button',
            onclick: async () => {
              return true;
            },
          },
        ],
        fadeIn() {
          const xul = `
            <html:label for="zen-welcome-set-default-browser">
              <html:input type="radio" id="zen-welcome-set-default-browser" name="zen-welcome-set-default-browser"></html:input>
              <html:span data-l10n-id="zen-welcome-set-default-browser"></html:span>
            </html:label>
            <html:label for="zen-welcome-dont-set-default-browser">
              <html:input checked="true" type="radio" id="zen-welcome-dont-set-default-browser" name="zen-welcome-set-default-browser"></html:input>
              <html:span data-l10n-id="zen-welcome-dont-set-default-browser"></html:span>
            </html:label>
          `;
          const fragment = window.MozXULElement.parseXULToFragment(xul);
          document.getElementById('zen-welcome-page-content').appendChild(fragment);
        },
        async fadeOut() {
          const shouldSetDefault = document.getElementById('zen-welcome-set-default-browser').checked;
          if (AppConstants.HAVE_SHELL_SERVICE && shouldSetDefault) {
            let shellSvc = getShellService();
            if (!shellSvc) {
              return;
            }

            try {
              await shellSvc.setDefaultBrowser(false);
            } catch (ex) {
              console.error(ex);
              return;
            }
          }
        },
      },
      {
        text: [
          {
            id: 'zen-welcome-workspace-colors-title',
          },
          {
            id: 'zen-welcome-workspace-colors-description',
          },
        ],
        buttons: [
          {
            l10n: 'zen-welcome-next-action',
            onclick: async () => {
              return true;
            },
          },
        ],
        fadeIn() {},
        fadeOut() {},
      },
      {
        text: [
          {
            id: 'zen-welcome-initial-essentials-title',
          },
          {
            id: 'zen-welcome-initial-essentials-description-1',
          },
          {
            id: 'zen-welcome-initial-essentials-description-2',
          },
        ],
        buttons: [
          {
            l10n: 'zen-welcome-next-action',
            onclick: async () => {
              return true;
            },
          },
        ],
        fadeIn() {
          const xul = `
            <hbox id="zen-welcome-initial-essentials-browser">
              <vbox id="zen-welcome-initial-essentials-browser-sidebar">
                <hbox id="zen-welcome-initial-essentials-browser-sidebar-win-buttons">
                  <html:div></html:div>
                  <html:div></html:div>
                  <html:div></html:div>
                </hbox>
                <html:div id="zen-welcome-initial-essentials-browser-sidebar-essentials">
                  <html:div class="tabbrowser-tab" fadein="" visuallyselected="" data-url="https://web.whatsapp.com" style="--zen-tab-icon: url('https://web.whatsapp.com/favicon.ico');">
                    <stack class="tab-stack">
                      <html:div class="tab-background"></html:div>
                    </stack>
                  </html:div>
                  <html:div class="tabbrowser-tab" fadein="" visuallyselected="" data-url="https://discord.com" style="--zen-tab-icon: url('http://www.google.com/s2/favicons?domain=discord.com');">
                    <stack class="tab-stack">
                      <html:div class="tab-background"></html:div>
                    </stack>
                  </html:div>
                  <html:div class="tabbrowser-tab" fadein="" data-url="https://reddit.com" style="--zen-tab-icon: url('https://www.redditstatic.com/desktop2x/img/favicon/favicon-96x96.png');">
                    <stack class="tab-stack">
                      <html:div class="tab-background"></html:div>
                    </stack>
                  </html:div>
                  <html:div class="tabbrowser-tab" fadein="" data-url="https://slack.com/" style="--zen-tab-icon: url('https://a.slack-edge.com/80588/marketing/img/meta/favicon-32.png');">
                    <stack class="tab-stack">
                      <html:div class="tab-background"></html:div>
                    </stack>
                  </html:div>
                  <html:div class="tabbrowser-tab" fadein="" visuallyselected="" data-url="https://google.com" style="--zen-tab-icon: url('https://www.google.com/s2/favicons?domain=google.com');">
                    <stack class="tab-stack">
                      <html:div class="tab-background"></html:div>
                    </stack>
                  </html:div>
                  <html:div class="tabbrowser-tab" fadein="" data-url="https://twitter.com" style="--zen-tab-icon: url('https://abs.twimg.com/favicons/twitter.ico');">
                    <stack class="tab-stack">
                      <html:div class="tab-background"></html:div>
                    </stack>
                  </html:div>
                  <html:div class="tabbrowser-tab" fadein="" data-url="https://notion.com" style="--zen-tab-icon: url('https://www.notion.so/front-static/favicon.ico');">
                    <stack class="tab-stack">
                      <html:div class="tab-background"></html:div>
                    </stack>
                  </html:div>
                  <html:div class="tabbrowser-tab" fadein="" data-url="https://instagram.com" style="--zen-tab-icon: url('https://www.instagram.com/static/images/ico/favicon-192.png/68d99ba29cc8.png');">
                    <stack class="tab-stack">
                      <html:div class="tab-background"></html:div>
                    </stack>
                  </html:div>
                  <html:div class="tabbrowser-tab" fadein="" visuallyselected="" data-url="https://element.io" style="--zen-tab-icon: url('http://www.google.com/s2/favicons?domain=element.io');">
                    <stack class="tab-stack">
                      <html:div class="tab-background"></html:div>
                    </stack>
                  </html:div>
                  <html:div class="extra-tab"></html:div>
                  <html:div class="extra-tab"></html:div>
                </html:div>
              </vbox>
            </hbox>
          `;
          const fragment = window.MozXULElement.parseXULToFragment(xul);
          document.getElementById('zen-welcome-page-content').appendChild(fragment);
          document
            .getElementById('zen-welcome-initial-essentials-browser-sidebar-essentials')
            .addEventListener('click', async (event) => {
              const tab = event.target.closest('.tabbrowser-tab');
              if (!tab) {
                return;
              }
              tab.toggleAttribute('visuallyselected');
            });
        },
        fadeOut() {},
      },
      {
        text: [
          {
            id: 'zen-welcome-start-browsing-title',
          },
          {
            id: 'zen-welcome-start-browsing-description-1',
          },
        ],
        buttons: [
          {
            l10n: 'zen-welcome-start-browsing',
            onclick: async () => {
              return true;
            },
          },
        ],
        fadeIn() {},
        fadeOut() {},
      },
    ];
  }

  async function animateInitialStage() {
    const [title1, title2] = await document.l10n.formatValues([
      { id: 'zen-welcome-title-line1' },
      { id: 'zen-welcome-title-line2' },
    ]);
    const titleElement = document.getElementById('zen-welcome-title');
    titleElement.innerHTML = `<html:span>${title1}</html:span><html:span>${title2}</html:span>`;
    await animate(
      '#zen-welcome-title span',
      { opacity: [0, 1], y: [20, 0], filter: ['blur(2px)', 'blur(0px)'] },
      {
        delay: getMotion().stagger(0.6, { startDelay: 0.2 }),
        type: 'spring',
        stiffness: 300,
        damping: 20,
        mass: 1.8,
      }
    );
    const button = document.getElementById('zen-welcome-start-button');
    await animate(
      button,
      { opacity: [0, 1], y: [20, 0], filter: ['blur(2px)', 'blur(0px)'] },
      {
        delay: 0.1,
        type: 'spring',
        stiffness: 300,
        damping: 20,
        mass: 1.8,
      }
    );
    button.addEventListener('click', async () => {
      await animate(
        '#zen-welcome-title span, #zen-welcome-start-button',
        { opacity: [1, 0], y: [0, -10], filter: ['blur(0px)', 'blur(2px)'] },
        {
          type: 'spring',
          ease: [0.755, 0.05, 0.855, 0.06],
          bounce: 0.4,
          delay: getMotion().stagger(0.4),
        }
      );
      new ZenWelcomePages(getWelcomePages());
    });
  }

  function centerWindowOnScreen() {
    window.addEventListener(
      'MozAfterPaint',
      function () {
        window.resizeTo(875, 560);
        window.focus();
        const appWin = window.docShell.treeOwner.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIAppWindow);
        appWin.rollupAllPopups();
      },
      { once: true }
    );
  }

  function startZenWelcome() {
    clearBrowserElements();
    centerWindowOnScreen();
    initializeZenWelcome();
    animateInitialStage();
  }

  startZenWelcome();
}
