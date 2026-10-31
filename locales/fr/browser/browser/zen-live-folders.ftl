# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

zen-live-folder-options = 
    .label = Options du dossier dynamique
zen-live-folder-last-fetched = 
    .label = Dernière récupération : { $time}
zen-live-folder-refresh = 
    .label = Actualiser
zen-live-folder-github-option-author-self = 
    .label = Créé par moi
zen-live-folder-github-option-assigned-self = 
    .label = Assigné à moi
zen-live-folder-github-option-review-requested = 
    .label = Mes demandes de révision
zen-live-folder-github-option-include-drafts = 
    .label = Inclure les pull requests en brouillon
zen-live-folder-type-rss = 
    .label = Flux RSS
zen-live-folder-option-fetch-interval = 
    .label = Intervalle de récupération
zen-live-folder-fetch-interval-mins = 
    .label =
        { $mins ->
            [one] 1 minute
           *[other] { $mins } minutes
        }
zen-live-folder-fetch-interval-hours = 
    .label =
        { $hours ->
            [one] 1 heure
           *[other] { $hours } heures
        }
zen-live-folder-rss-option-time-range = 
    .label = Intervalle de temps
zen-live-folder-time-range-hours = 
    .label =
        { $hours ->
            [one] Dernière heure
           *[other] Dernières { $hours } heures
        }
zen-live-folder-time-range-all-time = 
    .label = Depuis toujours
zen-live-folder-time-range-days = 
    .label =
        { $days ->
            [one] Dernier jour
           *[other] Derniers { $days } jours
        }
zen-live-folder-rss-option-item-limit = 
    .label = Limite d'éléments
zen-live-folder-rss-option-feed-url = 
    .label = URL du flux
zen-live-folder-rss-prompt-feed-url = Veuillez entrer l'URL du flux
zen-live-folder-rss-option-item-limit-num = 
    .label = { $limit } éléments
zen-live-folder-failed-fetch = 
    .label = Impossible de mettre à jour
    .tooltiptext = Impossible de mettre à jour. Réessayez.
zen-live-folder-github-no-auth = 
    .label = Non connecté à GitHub
    .tooltiptext = Reconnectez-vous à GitHub.
zen-live-folder-github-no-filter = 
    .label = Le filtre n'est pas défini
    .tooltiptext = Aucun filtre défini, rien ne sera récupéré.
zen-live-folder-rss-invalid-url-title = Impossible de créer le dossier dynamique
zen-live-folder-rss-invalid-url-description = L'URL du flux n'est pas valide. Vérifiez l'adresse et réessayez
zen-live-folder-github-option-repo-filter = 
    .label = Dépôts
zen-live-folder-github-option-repo = 
    .label = { $repo }
zen-live-folder-github-pull-requests = 
    .label = Pull requests
zen-live-folder-github-issues = 
    .label = Tickets
zen-live-folder-github-option-repo-list-note = 
    .label = Cette liste est générée en fonction de vos pull requests actuellement actives.
zen-live-folders-promotion-title = Dossier dynamique créé !
zen-live-folders-promotion-description = Les derniers contenus provenant de vos flux RSS ou de vos pull requests GitHub s'afficheront automatiquement ici.
