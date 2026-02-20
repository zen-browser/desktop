# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

zen-live-folder-options =
    .label = Live Folder Options

zen-live-folder-last-fetched =
    .label = Last fetch: { $time }

zen-live-folder-refresh =
    .label = Refresh

zen-live-folder-github-option-author-self =
    .label = Created by Me

zen-live-folder-github-option-assigned-self =
    .label = Assigned to Me

zen-live-folder-github-option-review-requested =
    .label = Review Requests

zen-live-folder-type-rss =
    .label = RSS Feed

zen-live-folder-option-fetch-interval =
    .label = Fetch Interval

zen-live-folder-fetch-interval-mins =
    .label = { $mins ->
      [one] 1 minute
      *[other] { $mins } minutes
    }

zen-live-folder-fetch-interval-hours =
    .label = { $hours ->
      [one] 1 hour
      *[other] { $hours } hours
    }

zen-live-folder-rss-option-time-range =
    .label = Time Range

zen-live-folder-time-range-hours =
    .label = { $hours ->
      [one] Last hour
      *[other] Last { $hours } hours
    }

zen-live-folder-time-range-all-time =
    .label = All time

zen-live-folder-time-range-days =
    .label = { $days ->
      [one] Last day
      *[other] Last { $days } days
    }

zen-live-folder-rss-option-item-limit =
    .label = Item Limit

zen-live-folder-rss-option-feed-url =
    .label = Feed URL

zen-live-folder-rss-prompt-feed-url = Please enter the feed URL

zen-live-folder-rss-option-item-limit-num =
    .label = { $limit } items

zen-live-folder-failed-fetch =
    .label = Failed to update
    .tooltiptext = Failed to update. Try again.

zen-live-folder-github-no-auth =
    .label = Not signed in to GitHub
    .tooltiptext = Sign back in to GitHub.

zen-live-folder-github-no-filter =
    .label = Filter is not set
    .tooltiptext = No filter set, nothing will be fetched.

zen-live-folder-rss-invalid-url-title = Failed to create the Live Folder
zen-live-folder-rss-invalid-url-description = The feed URL is invalid. Check the address and try again

zen-live-folder-github-option-repo-filter =
    .label = Repositories

zen-live-folder-github-option-repo =
    .label = { $repo }

zen-live-folder-github-pull-requests =
    .label = Pull Requests

zen-live-folder-github-issues =
    .label = Issues

zen-live-folder-github-option-repo-list-note =
    .label = This list is generated based on your currently active pull requests.
