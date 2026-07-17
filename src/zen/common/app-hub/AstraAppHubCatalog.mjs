/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Packaged Astra App Hub catalog (pure data, no browser/window code).
 * Canonical advanced catalog source — imported lazily by AstraAppHubManager.
 */

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      deepFreeze(item);
    }
  } else {
    for (const key of Object.keys(value)) {
      deepFreeze(value[key]);
    }
  }
  return Object.freeze(value);
}

export const ASTRA_APP_HUB_CATALOG = deepFreeze({
  schemaVersion: 1,
  categories: [
  {
    "id": "mail",
    "label": "Mail",
    "order": 10
  },
  {
    "id": "meetings",
    "label": "Meetings",
    "order": 20
  },
  {
    "id": "storage",
    "label": "Storage",
    "order": 30
  },
  {
    "id": "productivity",
    "label": "Productivity",
    "order": 40
  },
  {
    "id": "education",
    "label": "Education",
    "order": 50
  },
  {
    "id": "entertainment",
    "label": "Entertainment",
    "order": 60
  },
  {
    "id": "shopping",
    "label": "Shopping",
    "order": 70
  },
  {
    "id": "government",
    "label": "Government",
    "order": 80
  },
  {
    "id": "news",
    "label": "News",
    "order": 90
  },
  {
    "id": "business",
    "label": "Business",
    "order": 100
  }
],
  apps: [
  {
    "id": "gmail",
    "name": "Gmail",
    "url": "https://gmail.com",
    "category": "mail",
    "order": 10,
    "builtin": true,
    "iconKey": "gmail",
    "monogram": "G",
    "keywords": [
      "mail",
      "email",
      "google"
    ],
    "hostname": "gmail.com"
  },
  {
    "id": "outlook",
    "name": "Outlook",
    "url": "https://outlook.com",
    "category": "mail",
    "order": 20,
    "builtin": true,
    "iconKey": "outlook",
    "monogram": "O",
    "keywords": [
      "mail",
      "email",
      "microsoft",
      "hotmail"
    ],
    "hostname": "outlook.com"
  },
  {
    "id": "zoho-mail",
    "name": "Zoho Mail",
    "url": "https://mail.zoho.in",
    "category": "mail",
    "order": 30,
    "builtin": true,
    "iconKey": "zoho-mail",
    "monogram": "ZM",
    "keywords": [
      "mail",
      "email",
      "zoho"
    ],
    "hostname": "mail.zoho.in"
  },
  {
    "id": "yahoo-mail",
    "name": "Yahoo Mail",
    "url": "https://mail.yahoo.com",
    "category": "mail",
    "order": 40,
    "builtin": true,
    "iconKey": "yahoo-mail",
    "monogram": "Y",
    "keywords": [
      "mail",
      "email",
      "yahoo"
    ],
    "hostname": "mail.yahoo.com"
  },
  {
    "id": "protonmail",
    "name": "ProtonMail",
    "url": "https://proton.me",
    "category": "mail",
    "order": 50,
    "builtin": true,
    "iconKey": "protonmail",
    "monogram": "P",
    "keywords": [
      "mail",
      "email",
      "proton",
      "privacy"
    ],
    "hostname": "proton.me"
  },
  {
    "id": "google-meet",
    "name": "Google Meet",
    "url": "https://meet.google.com",
    "category": "meetings",
    "order": 10,
    "builtin": true,
    "iconKey": "google-meet",
    "monogram": "GM",
    "keywords": [
      "meet",
      "video",
      "google",
      "call"
    ],
    "hostname": "meet.google.com"
  },
  {
    "id": "zoom",
    "name": "Zoom",
    "url": "https://zoom.us/join",
    "category": "meetings",
    "order": 20,
    "builtin": true,
    "iconKey": "zoom",
    "monogram": "Z",
    "keywords": [
      "meet",
      "video",
      "call"
    ],
    "hostname": "zoom.us"
  },
  {
    "id": "ms-teams",
    "name": "MS Teams",
    "url": "https://teams.microsoft.com",
    "category": "meetings",
    "order": 30,
    "builtin": true,
    "iconKey": "ms-teams",
    "monogram": "MT",
    "keywords": [
      "meet",
      "teams",
      "microsoft",
      "video"
    ],
    "hostname": "teams.microsoft.com"
  },
  {
    "id": "webex",
    "name": "Webex",
    "url": "https://webex.com",
    "category": "meetings",
    "order": 40,
    "builtin": true,
    "iconKey": "webex",
    "monogram": "W",
    "keywords": [
      "meet",
      "cisco",
      "video"
    ],
    "hostname": "webex.com"
  },
  {
    "id": "google-drive",
    "name": "Google Drive",
    "url": "https://drive.google.com",
    "category": "storage",
    "order": 10,
    "builtin": true,
    "iconKey": "google-drive",
    "monogram": "GD",
    "keywords": [
      "drive",
      "storage",
      "google",
      "files"
    ],
    "hostname": "drive.google.com"
  },
  {
    "id": "onedrive",
    "name": "OneDrive",
    "url": "https://onedrive.live.com",
    "category": "storage",
    "order": 20,
    "builtin": true,
    "iconKey": "onedrive",
    "monogram": "OD",
    "keywords": [
      "storage",
      "microsoft",
      "files"
    ],
    "hostname": "onedrive.live.com"
  },
  {
    "id": "dropbox",
    "name": "Dropbox",
    "url": "https://dropbox.com",
    "category": "storage",
    "order": 30,
    "builtin": true,
    "iconKey": "dropbox",
    "monogram": "D",
    "keywords": [
      "storage",
      "files",
      "cloud"
    ],
    "hostname": "dropbox.com"
  },
  {
    "id": "zoho-drive",
    "name": "Zoho Drive",
    "url": "https://workdrive.zoho.in",
    "category": "storage",
    "order": 40,
    "builtin": true,
    "iconKey": "zoho-drive",
    "monogram": "ZD",
    "keywords": [
      "storage",
      "zoho",
      "files"
    ],
    "hostname": "workdrive.zoho.in"
  },
  {
    "id": "google-docs",
    "name": "Google Docs",
    "url": "https://docs.google.com",
    "category": "productivity",
    "order": 10,
    "builtin": true,
    "iconKey": "google-docs",
    "monogram": "Do",
    "keywords": [
      "docs",
      "documents",
      "google",
      "office"
    ],
    "hostname": "docs.google.com"
  },
  {
    "id": "microsoft-365",
    "name": "Microsoft 365",
    "url": "https://microsoft365.com",
    "category": "productivity",
    "order": 20,
    "builtin": true,
    "iconKey": "microsoft-365",
    "monogram": "M",
    "keywords": [
      "office",
      "microsoft",
      "365",
      "word"
    ],
    "hostname": "microsoft365.com"
  },
  {
    "id": "notion",
    "name": "Notion",
    "url": "https://notion.so",
    "category": "productivity",
    "order": 30,
    "builtin": true,
    "iconKey": "notion",
    "monogram": "N",
    "keywords": [
      "notes",
      "wiki",
      "docs"
    ],
    "hostname": "notion.so"
  },
  {
    "id": "canva",
    "name": "Canva",
    "url": "https://canva.com",
    "category": "productivity",
    "order": 40,
    "builtin": true,
    "iconKey": "canva",
    "monogram": "C",
    "keywords": [
      "design",
      "graphics"
    ],
    "hostname": "canva.com"
  },
  {
    "id": "zoho-docs",
    "name": "Zoho Docs",
    "url": "https://sheet.zoho.in",
    "category": "productivity",
    "order": 50,
    "builtin": true,
    "iconKey": "zoho-docs",
    "monogram": "Zo",
    "keywords": [
      "docs",
      "zoho"
    ],
    "hostname": "sheet.zoho.in"
  },
  {
    "id": "classroom",
    "name": "Classroom",
    "url": "https://classroom.google.com",
    "category": "education",
    "order": 10,
    "builtin": true,
    "iconKey": "classroom",
    "monogram": "Cl",
    "keywords": [
      "education",
      "google",
      "school"
    ],
    "hostname": "classroom.google.com"
  },
  {
    "id": "teams-edu",
    "name": "Teams EDU",
    "url": "https://teams.microsoft.com",
    "category": "education",
    "order": 20,
    "builtin": true,
    "iconKey": "teams-edu",
    "monogram": "TE",
    "keywords": [
      "education",
      "teams",
      "microsoft"
    ],
    "hostname": "teams.microsoft.com"
  },
  {
    "id": "zoom-edu",
    "name": "Zoom EDU",
    "url": "https://zoom.us/education",
    "category": "education",
    "order": 30,
    "builtin": true,
    "iconKey": "zoom-edu",
    "monogram": "ZE",
    "keywords": [
      "education",
      "zoom"
    ],
    "hostname": "zoom.us"
  },
  {
    "id": "swayam",
    "name": "SWAYAM",
    "url": "https://swayam.gov.in",
    "category": "education",
    "order": 40,
    "builtin": true,
    "iconKey": "swayam",
    "monogram": "S",
    "keywords": [
      "education",
      "india",
      "courses"
    ],
    "hostname": "swayam.gov.in"
  },
  {
    "id": "youtube",
    "name": "YouTube",
    "url": "https://youtube.com",
    "category": "entertainment",
    "order": 10,
    "builtin": true,
    "iconKey": "youtube",
    "monogram": "YT",
    "keywords": [
      "video",
      "google",
      "watch"
    ],
    "hostname": "youtube.com"
  },
  {
    "id": "spotify",
    "name": "Spotify",
    "url": "https://spotify.com",
    "category": "entertainment",
    "order": 20,
    "builtin": true,
    "iconKey": "spotify",
    "monogram": "Sp",
    "keywords": [
      "music",
      "audio"
    ],
    "hostname": "spotify.com"
  },
  {
    "id": "jiosaavn",
    "name": "JioSaavn",
    "url": "https://jiosaavn.com",
    "category": "entertainment",
    "order": 30,
    "builtin": true,
    "iconKey": "jiosaavn",
    "monogram": "JS",
    "keywords": [
      "music",
      "india",
      "audio"
    ],
    "hostname": "jiosaavn.com"
  },
  {
    "id": "jiohotstar",
    "name": "JioHotstar",
    "url": "https://jiohotstar.com",
    "category": "entertainment",
    "order": 40,
    "builtin": true,
    "iconKey": "jiohotstar",
    "monogram": "JH",
    "keywords": [
      "video",
      "streaming",
      "india"
    ],
    "hostname": "jiohotstar.com"
  },
  {
    "id": "netflix",
    "name": "Netflix",
    "url": "https://netflix.com",
    "category": "entertainment",
    "order": 50,
    "builtin": true,
    "iconKey": "netflix",
    "monogram": "Nf",
    "keywords": [
      "video",
      "streaming"
    ],
    "hostname": "netflix.com"
  },
  {
    "id": "amazon",
    "name": "Amazon",
    "url": "https://amazon.in",
    "category": "shopping",
    "order": 10,
    "builtin": true,
    "iconKey": "amazon",
    "monogram": "A",
    "keywords": [
      "shop",
      "shopping",
      "india"
    ],
    "hostname": "amazon.in"
  },
  {
    "id": "flipkart",
    "name": "Flipkart",
    "url": "https://flipkart.com",
    "category": "shopping",
    "order": 20,
    "builtin": true,
    "iconKey": "flipkart",
    "monogram": "F",
    "keywords": [
      "shop",
      "shopping",
      "india"
    ],
    "hostname": "flipkart.com"
  },
  {
    "id": "meesho",
    "name": "Meesho",
    "url": "https://meesho.com",
    "category": "shopping",
    "order": 30,
    "builtin": true,
    "iconKey": "meesho",
    "monogram": "Me",
    "keywords": [
      "shop",
      "shopping",
      "india"
    ],
    "hostname": "meesho.com"
  },
  {
    "id": "myntra",
    "name": "Myntra",
    "url": "https://myntra.com",
    "category": "shopping",
    "order": 40,
    "builtin": true,
    "iconKey": "myntra",
    "monogram": "My",
    "keywords": [
      "shop",
      "fashion",
      "india"
    ],
    "hostname": "myntra.com"
  },
  {
    "id": "irctc",
    "name": "IRCTC",
    "url": "https://irctc.co.in",
    "category": "government",
    "order": 10,
    "builtin": true,
    "iconKey": "irctc",
    "monogram": "I",
    "keywords": [
      "train",
      "rail",
      "india",
      "travel"
    ],
    "hostname": "irctc.co.in"
  },
  {
    "id": "income-tax",
    "name": "Income Tax",
    "url": "https://incometax.gov.in",
    "category": "government",
    "order": 20,
    "builtin": true,
    "iconKey": "income-tax",
    "monogram": "IT",
    "keywords": [
      "tax",
      "india",
      "gov"
    ],
    "hostname": "incometax.gov.in"
  },
  {
    "id": "digilocker",
    "name": "DigiLocker",
    "url": "https://digilocker.gov.in",
    "category": "government",
    "order": 30,
    "builtin": true,
    "iconKey": "digilocker",
    "monogram": "DL",
    "keywords": [
      "gov",
      "india",
      "documents"
    ],
    "hostname": "digilocker.gov.in"
  },
  {
    "id": "gst-portal",
    "name": "GST Portal",
    "url": "https://gst.gov.in",
    "category": "government",
    "order": 40,
    "builtin": true,
    "iconKey": "gst-portal",
    "monogram": "GST",
    "keywords": [
      "gst",
      "tax",
      "india",
      "gov"
    ],
    "hostname": "gst.gov.in"
  },
  {
    "id": "epfo",
    "name": "EPFO",
    "url": "https://epfindia.gov.in",
    "category": "government",
    "order": 50,
    "builtin": true,
    "iconKey": "epfo",
    "monogram": "E",
    "keywords": [
      "pf",
      "pension",
      "india",
      "gov"
    ],
    "hostname": "epfindia.gov.in"
  },
  {
    "id": "inshorts",
    "name": "Inshorts",
    "url": "https://inshorts.com",
    "category": "news",
    "order": 10,
    "builtin": true,
    "iconKey": "inshorts",
    "monogram": "In",
    "keywords": [
      "news",
      "india"
    ],
    "hostname": "inshorts.com"
  },
  {
    "id": "ndtv",
    "name": "NDTV",
    "url": "https://ndtv.com",
    "category": "news",
    "order": 20,
    "builtin": true,
    "iconKey": "ndtv",
    "monogram": "ND",
    "keywords": [
      "news",
      "india"
    ],
    "hostname": "ndtv.com"
  },
  {
    "id": "toi",
    "name": "TOI",
    "url": "https://timesofindia.com",
    "category": "news",
    "order": 30,
    "builtin": true,
    "iconKey": "toi",
    "monogram": "T",
    "keywords": [
      "news",
      "india",
      "times"
    ],
    "hostname": "timesofindia.com"
  },
  {
    "id": "google-news",
    "name": "Google News",
    "url": "https://news.google.com",
    "category": "news",
    "order": 40,
    "builtin": true,
    "iconKey": "google-news",
    "monogram": "GN",
    "keywords": [
      "news",
      "google"
    ],
    "hostname": "news.google.com"
  },
  {
    "id": "linkedin",
    "name": "LinkedIn",
    "url": "https://linkedin.com",
    "category": "business",
    "order": 10,
    "builtin": true,
    "iconKey": "linkedin",
    "monogram": "L",
    "keywords": [
      "jobs",
      "network",
      "business"
    ],
    "hostname": "linkedin.com"
  },
  {
    "id": "slack",
    "name": "Slack",
    "url": "https://slack.com",
    "category": "business",
    "order": 20,
    "builtin": true,
    "iconKey": "slack",
    "monogram": "Sl",
    "keywords": [
      "chat",
      "work",
      "business"
    ],
    "hostname": "slack.com"
  },
  {
    "id": "freshdesk",
    "name": "Freshdesk",
    "url": "https://freshdesk.com",
    "category": "business",
    "order": 30,
    "builtin": true,
    "iconKey": "freshdesk",
    "monogram": "Fr",
    "keywords": [
      "support",
      "helpdesk",
      "business"
    ],
    "hostname": "freshdesk.com"
  },
  {
    "id": "trello",
    "name": "Trello",
    "url": "https://trello.com",
    "category": "business",
    "order": 40,
    "builtin": true,
    "iconKey": "trello",
    "monogram": "Tr",
    "keywords": [
      "boards",
      "tasks",
      "business"
    ],
    "hostname": "trello.com"
  }
],
});
