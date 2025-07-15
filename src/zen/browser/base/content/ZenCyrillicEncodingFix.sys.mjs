/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

export const ZenCyrillicEncodingFix = {
  // Cyrillic character range detection
  CYRILLIC_REGEX: /[\u0400-\u04FF]/,

  init() {
    // Listen for form submissions
    Services.obs.addObserver(this, 'earlyformsubmit');
  },

  observe(subject, topic, data) {
    if (topic === 'earlyformsubmit') {
      this.handleFormSubmission(subject);
    }
  },

  handleFormSubmission(form) {
    // Apply fix to all sites with Cyrillic content
    this.fixCyrillicEncoding(form);
  },

  fixCyrillicEncoding(form) {
    const inputs = form.querySelectorAll('input[type="text"], input[type="search"], textarea');

    for (const input of inputs) {
      if (this.CYRILLIC_REGEX.test(input.value)) {
        // Ensure proper UTF-8 encoding for Cyrillic characters
        input.setAttribute('accept-charset', 'UTF-8');

        // Force the form to use UTF-8 encoding
        if (form.acceptCharset !== 'UTF-8') {
          form.acceptCharset = 'UTF-8';
        }
      }
    }
  },

  uninit() {
    Services.obs.removeObserver(this, 'earlyformsubmit');
  },
};
