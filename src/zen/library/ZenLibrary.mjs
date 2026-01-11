/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { nsZenPreloadedFeature } from "chrome://browser/content/zen-components/ZenCommonUtils.mjs";

class ZenLibrary extends nsZenPreloadedFeature {
    constructor() {
        super();
        this.name = "ZenLibrary";
        this._isOpen = false;
        this._container = null;
    }

    init() {
        console.log("ZenLibrary: Initializing...");
        window.addEventListener("keydown", (e) => this._onKeyDown(e), true);
    }

    _onKeyDown(e) {
        if (e.altKey && e.shiftKey && e.code === "KeyB") {
            e.preventDefault();
            e.stopPropagation();
            this.toggle();
        }
    }

    toggle() {
        if (this._isOpen) {
            this.close();
        } else {
            this.open();
        }
    }

    open() {
        if (this._isOpen) return;
        
        const toolbox = document.getElementById("navigator-toolbox");
        if (!toolbox) return;

        this._isOpen = true;
        
        if (!this._container) {
            this._container = document.createElement("div");
            this._container.id = "zen-library-container";
            this._container.innerHTML = `
                <div id="zen-library-sidebar-new">
                    <div class="zen-library-sidebar-top"></div>
                    <div class="zen-library-sidebar-items">
                        <div class="sidebar-item" data-id="downloads" title="Downloads">
                            <div class="icon downloads-icon"></div>
                            <span class="label">Downloads</span>
                        </div>
                        <div class="sidebar-item active" data-id="media" title="Media">
                            <div class="icon media-icon"></div>
                            <span class="label">Media</span>
                        </div>
                        <div class="sidebar-item" data-id="history" title="History">
                            <div class="icon history-icon"></div>
                            <span class="label">History</span>
                        </div>
                        <div class="sidebar-item" data-id="spaces" title="Spaces">
                            <div class="icon spaces-icon"></div>
                            <span class="label">Spaces</span>
                        </div>
                    </div>
                    <div class="zen-library-sidebar-bottom">
                        <div class="sidebar-item exit-btn" data-id="exit">
                            <div class="icon back-icon"></div>
                            <span class="label">Exit Library</span>
                        </div>
                    </div>
                </div>
                <div id="zen-library-main-panel">
                    <header class="library-header">
                        <div class="search-container">
                            <div class="search-icon"></div>
                            <input type="text" placeholder="Search Media..." />
                        </div>
                    </header>
                    <div class="library-content">
                        <div class="empty-state">
                            <div class="empty-icon media-icon"></div>
                            <h3>Nothing here yet!</h3>
                            <p>Save media to your Documents, Desktop, and Download Folders to see them here.</p>
                            <button class="learn-more">Learn more</button>
                        </div>
                    </div>
                </div>
            `;
            
            this._container.querySelectorAll(".sidebar-item").forEach(item => {
                item.addEventListener("click", () => {
                    if (item.dataset.id === "exit") {
                        this.close();
                        return;
                    }
                    this._container.querySelectorAll(".sidebar-item").forEach(i => i.classList.remove("active"));
                    item.classList.add("active");
                    this._updateFeatureContent(item.dataset.id);
                });
            });
        }
        
        if (!this._container.parentElement) {
            toolbox.appendChild(this._container);
        }
        
        document.documentElement.setAttribute("zen-library-open", "true");
        console.log("ZenLibrary: Opened (Instant)");
    }

    _updateFeatureContent(featureId) {
        const title = featureId.charAt(0).toUpperCase() + featureId.slice(1);
        const searchInput = this._container.querySelector(".search-container input");
        const emptyIcon = this._container.querySelector(".empty-icon");
        const emptyTitle = this._container.querySelector(".empty-state h3");
        const emptyDesc = this._container.querySelector(".empty-state p");

        if (searchInput) searchInput.placeholder = `Search ${title}...`;
        if (emptyIcon) emptyIcon.className = `empty-icon ${featureId}-icon`;
        if (emptyTitle) emptyTitle.textContent = `Nothing here yet!`;
        
        if (emptyDesc) {
            if (featureId === "media") {
                emptyDesc.textContent = "Save media to your Documents, Desktop, and Download Folders to see them here.";
            } else {
                emptyDesc.textContent = `Content for ${title} will be displayed here once available.`;
            }
        }
    }

    close() {
        if (!this._isOpen) return;
        this._isOpen = false;
        
        document.documentElement.removeAttribute("zen-library-open");
        
        if (this._container && this._container.parentElement) {
            this._container.remove();
        }
        console.log("ZenLibrary: Closed (Instant)");
    }
}

window.gZenLibrary = new ZenLibrary();
if (document.readyState !== "loading") {
    gZenLibrary.init();
}
