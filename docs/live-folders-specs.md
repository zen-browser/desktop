# Zen Live Folders - Specification

## Overview

Live Folders are dynamic, auto-updating folders in Zen.  
Unlike static folders, they fetch and refresh their contents automatically from external sources (e.g., RSS feeds, APIs).  
By default, Live Folders refresh every **30 minutes**, but this interval can be configured in preferences.

---

## Architecture

### `LiveFolderProvider`

- **Abstract base class** for all live folder implementations.
- Defines the contract for fetching and updating live folder contents.
- Responsibilities:
  - Define how to fetch items (abstract method `fetchItems()`).
  - Handle update intervals (default: 30 min).
  - Manage serialization/deserialization of folder state (cache, last update time).
  - Provide metadata (icon, label, description).

```ts
interface FolderItem {
  id: string;
  title: string;
  url: string;
}

interface FolderMetadata {
  icon: string;
  label: string;
}

interface LiveFolderProvider {
  fetchItems(): Promise<FolderItem[]>;
  getMetadata(): FolderMetadata;
}
```

### Implementations

#### `RssLiveFolderProvider`

- **Description**: Updates live folder contents from an RSS/Atom feed.
- **Configuration**:
  - `url`: URL of the RSS feed.

#### `GithubLiveFolderProvider`

- **Description**: Updates live folder contents from GitHub user's Pull Requests.
- **Configuration**:
  - `username`: GitHub username.

#### `RestAPILiveFolderProvider`

- **Description**: Updates live folder contents from a REST API endpoint.
- **Configuration**:
  - `schema`: JSON schema to validate API responses.

#### Possible future implementations

- `WebhookLiveFolderProvider`

---

# REST API Live Folder Schema

## Overview

REST-based Live Folders allow Zen to fetch JSON data from an HTTP(S) endpoint and map it into folder items.  
Each REST Live Folder must provide a **schema-compliant response** that Zen can parse into items.

- **Remote APIs (https://, http://)**: Flexible schema (mapping via config).
- **Localhost APIs (http://127.0.0.1, http://localhost)**: Must strictly follow Zen’s **Local REST Schema** for security and consistency.

---

## Common Rules

- Requests are always `GET`.
- Responses **must be JSON**.
- CORS headers are ignored (Zen fetches internally).
- Max response size: **1 MB** (to prevent abuse).
- Items exceeding `liveFolder.maxItems` (default 100) will be trimmed.

---

## Remote REST Schema

Remote APIs can return any JSON, but the Live Folder must provide a mapping configuration:

```json
{
  "type": "rest",
  "url": "https://api.example.com/posts",
  "mapping": {
    "items": "data.posts",
    "id": "id",
    "title": "headline",
    "url": "link"
  }
}
```
