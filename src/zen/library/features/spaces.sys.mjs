/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

export class ZenLibrarySpaces {
    static getWorkspaces() {
        if (!window.gZenWorkspaces) {
            return [];
        }
        return window.gZenWorkspaces.getWorkspaces();
    }

    static calculatePanelWidth(workspaceCount) {
        const cardWidth = 240;
        const gap = 16;
        const sidebarWidth = 90;
        const padding = 40;

        // Calculate total width needed: sidebar + padding + (cards * width) + (gaps between cards)
        const totalWidth = sidebarWidth + padding + (workspaceCount * cardWidth) + ((workspaceCount - 1) * gap);

        // Max width is 80vw
        const maxWidth = window.innerWidth * 0.8;

        return Math.min(totalWidth, maxWidth);
    }

    static getData() {
        const workspaces = this.getWorkspaces();

        if (workspaces.length === 0) {
            return {
                workspaces: [],
                width: 340
            };
        }

        const panelWidth = this.calculatePanelWidth(workspaces.length);

        return {
            workspaces,
            width: panelWidth
        };
    }

    static getWorkspaceTheme(workspace) {
        if (!workspace) return { gradient: "var(--zen-primary-color)", grain: 0 };

        if (window.gZenThemePicker && window.gZenThemePicker.getGradientForWorkspace) {
            return window.gZenThemePicker.getGradientForWorkspace(workspace);
        }
        return { gradient: "var(--zen-primary-color)", grain: 0 };
    }

    static renderCard(html, workspace) {
        if (!workspace) return null;

        const theme = this.getWorkspaceTheme(workspace);

        // Icon Logic
        let iconContent;
        if (workspace.icon) {
            if (workspace.icon.includes("/") || workspace.icon.includes("data:")) {
                iconContent = html`<img src="${workspace.icon}" class="library-workspace-icon" />`;
            } else {
                // Emoji or character
                iconContent = html`<span class="library-workspace-icon-text">${workspace.icon}</span>`;
            }
        } else {
            // Empty state
            iconContent = html`<div class="library-workspace-icon-empty"></div>`;
        }

        // Apply styles as CSS variables
        const style = `
        --ws-gradient: ${theme.gradient || "var(--zen-primary-color)"};
        --ws-grain: ${theme.grain || 0};
    `;

        return html`
      <div 
        class="library-workspace-card"
        style="${style}"
      >
        <div class="library-workspace-card-header">
           <div class="library-workspace-icon-container">
             ${iconContent}
           </div>
           <span class="library-workspace-name">${workspace.name}</span>
        </div>
        <div class="library-workspace-content">
           <!-- Content placeholder -->
        </div>
      </div>
    `;
    }
}
