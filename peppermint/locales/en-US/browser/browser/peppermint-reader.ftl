# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

## Save button in the site panel while an article is open in Reader Mode

peppermint-reader-save-button =
    .tooltiptext = Save for offline reading
    .aria-label = Save for offline reading
peppermint-reader-unsave-button =
    .tooltiptext = Remove from saved articles
    .aria-label = Remove from saved articles

## Toasts

peppermint-reader-saved-toast = Saved for offline reading
peppermint-reader-removed-toast = Removed from saved articles
peppermint-reader-error-toast = Could not save this article
peppermint-reader-no-text-toast = No readable text found on this page

## Saved articles page (about:saved)

peppermint-saved-title = Saved articles
peppermint-saved-search =
    .placeholder = Search saved articles
    .aria-label = Search saved articles
peppermint-saved-clear-all = Clear all
peppermint-saved-clear-confirm = Click again to confirm
peppermint-saved-remove =
    .title = Remove
    .aria-label = Remove
peppermint-saved-open-new-tab =
    .title = Open in a new tab
    .aria-label = Open in a new tab
peppermint-saved-empty-title = Nothing saved yet
peppermint-saved-empty-description = Open a page in Reader Mode and choose Save for offline reading in the site panel. It will be here, ready to read without a connection.
peppermint-saved-no-results = No saved articles match your search.
peppermint-saved-storage = { $count ->
    [one] { $count } article, { $size }
   *[other] { $count } articles, { $size }
}
peppermint-saved-saved-on = Saved { $date }
peppermint-saved-reading-time = { $minutes } min read
peppermint-saved-open-error = This article could not be opened.
