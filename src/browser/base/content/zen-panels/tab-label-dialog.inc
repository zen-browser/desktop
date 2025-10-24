# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

<panel id="zenTabLabelDialog"
       type="arrow"
       position="after_start"
       hidden="true"
       noautohide="true"
       flip="both">
  <vbox class="zen-tab-label-dialog-container" padding="16">
    <html:div class="zen-tab-label-dialog-header">
      <html:h3 id="zenTabLabelDialogTitle" data-l10n-id="zen-tab-label-dialog-new-title">Add Label</html:h3>
    </html:div>

    <html:div class="zen-tab-label-dialog-content">
      <html:div class="zen-tab-label-input-group">
        <html:label for="zenTabLabelInput" data-l10n-id="zen-tab-label-input-label">Label Text</html:label>
        <html:input id="zenTabLabelInput"
                    type="text"
                    class="zen-tab-label-input"
                    placeholder="Enter label..."
                    data-l10n-attrs="placeholder"
                    maxlength="50" />
      </html:div>

      <html:div class="zen-tab-label-color-group">
        <html:label for="zenTabLabelColorPicker" data-l10n-id="zen-tab-label-color-label">Color</html:label>
        <html:div class="zen-tab-label-color-picker-container">
          <html:input id="zenTabLabelColorPicker"
                      type="color"
                      class="zen-tab-label-color-picker" />
          <html:span class="zen-tab-label-color-preview"></html:span>
        </html:div>
      </html:div>
    </html:div>

    <html:div class="zen-tab-label-dialog-actions">
      <html:button id="zenTabLabelCancel"
                   class="zen-tab-label-button zen-tab-label-button-secondary"
                   data-l10n-id="zen-tab-label-cancel">
        Cancel
      </html:button>
      <html:button id="zenTabLabelSave"
                   class="zen-tab-label-button zen-tab-label-button-primary"
                   data-l10n-id="zen-tab-label-save">
        Save
      </html:button>
    </html:div>
  </vbox>
</panel>
