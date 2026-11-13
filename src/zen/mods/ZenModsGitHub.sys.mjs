// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import {
  download,
  encodePath,
  findStyle,
  MAX_FILE_BYTES,
  MAX_REMOTE_FILES,
  parseManifest,
  pathParts,
} from "resource:///modules/zen/mods/ZenModsFiles.sys.mjs";
import { hashScripts } from "resource:///modules/zen/mods/ZenModsScripts.sys.mjs";
import { assertLocalStyles } from "resource:///modules/zen/mods/ZenModsStyleChecks.sys.mjs";

/*
 * Mods installed from a GitHub repository: where they live, what a commit
 * of it holds, and a copy of its files.
 */

const GITHUB_API_URL_PREF = "zen.mods.github.api-url";
const GITHUB_RAW_URL_PREF = "zen.mods.github.raw-url";
const GITHUB_URL_RE = /^(?:https?:\/\/)?(?:www\.)?github\.com\//i;
const GITHUB_RAW_URL_RE = /^(?:https?:\/\/)?raw\.githubusercontent\.com\//i;
const URL_QUERY_RE = /[?#].*$/s;
const REF_PREFIXES = new Set(["heads", "tags"]);
const GITHUB_NAME_RE = /^[A-Za-z0-9_.-]{1,100}$/;
const TRAILING_SLASHES_RE = /\/+$/;
const DOT_GIT_RE = /\.git$/;
const COMMIT_SHA_RE = /^[0-9a-f]{40}$/;
const MAX_REMOTE_BYTES = 20 * 1024 * 1024;
const PARALLEL_DOWNLOADS = 6;
const REGEXP_ESCAPE_RE = /[.*+?^${}()|[\]\\]/g;

/**
 * Reads where a mod lives on GitHub from what the user typed.
 *
 * shortcut: in a /tree/ URL the branch is one segment, so branches with "/"
 * in their name read as branch and folder; parse the full ref with the API if
 * people need them.
 *
 * @param {*} input - "owner/repo", "owner/repo/folder" or a github.com URL,
 * with "/tree/<branch>/<folder>" for a branch other than the default one. A
 * link to the mod's `theme.json`, on github.com or raw.githubusercontent.com,
 * stands for its folder.
 * @returns {{repo: string, ref: string|null, folder: string}} The
 * repository as "owner/repo", the branch and the folder of the mod
 */
export function parseGitHubSource(input) {
  const link = String(input ?? "")
    .trim()
    .replace(URL_QUERY_RE, "");
  const isRawLink = GITHUB_RAW_URL_RE.test(link);
  const text = link
    .replace(isRawLink ? GITHUB_RAW_URL_RE : GITHUB_URL_RE, "")
    .replace(TRAILING_SLASHES_RE, "");
  const [owner = "", repoName = "", ...rest] = text.split("/");
  const repo = repoName.replace(DOT_GIT_RE, "");
  const isName = name =>
    GITHUB_NAME_RE.test(name) && name !== "." && name !== "..";

  let ref = null;
  let folder = rest;
  let isFileLink = isRawLink;

  if (isRawLink) {
    // GitHub's own raw links spell the branch as refs/heads/<branch>.
    const start = rest[0] === "refs" && REF_PREFIXES.has(rest[1]) ? 2 : 0;

    ref = rest[start] ?? "";
    folder = rest.slice(start + 1);
  } else if ((rest[0] === "tree" || rest[0] === "blob") && rest.length > 1) {
    isFileLink = rest[0] === "blob";
    ref = rest[1];
    folder = rest.slice(2);
  }

  const isModFile = !isFileLink || folder.at(-1) === "theme.json";

  if (isFileLink) {
    folder = folder.slice(0, -1);
  }

  const isValid =
    isModFile &&
    isName(owner) &&
    isName(repo) &&
    (ref === null || isName(ref)) &&
    (!folder.length || pathParts(folder.join("/")));

  if (!isValid) {
    throw new Error(`[ZenMods]: Not a GitHub repository: ${input}`);
  }

  return { repo: `${owner}/${repo}`, ref, folder: folder.join("/") };
}

/**
 * @param {object} mod - A mod of the registry installed from GitHub
 * @returns {{repo: string, ref: string|null, folder: string}}
 */
export function gitHubSourceOf(mod) {
  return parseGitHubSource(
    [mod.repo, mod.ref && `tree/${mod.ref}`, mod.folder]
      .filter(Boolean)
      .join("/")
  );
}

/**
 * @param {string} repo - "owner/repo"
 * @returns {string}
 */
function gitHubApiUrl(repo) {
  return `${Services.prefs.getStringPref(GITHUB_API_URL_PREF)}repos/${repo}/`;
}

/**
 * @param {string} repo - "owner/repo"
 * @returns {string[]} Where its API answers may come from: a renamed or
 * moved repository redirects to its numeric id
 */
function gitHubApiPrefixes(repo) {
  return [
    gitHubApiUrl(repo),
    `${Services.prefs.getStringPref(GITHUB_API_URL_PREF)}repositories/`,
  ];
}

/**
 * @param {string} repo - "owner/repo"
 * @param {string} folder
 * @param {string} sha
 * @returns {string} Where the mod's files are, at that commit
 */
function gitHubRawUrl(repo, folder, sha) {
  const path = folder ? `${encodePath(folder)}/` : "";

  return `${Services.prefs.getStringPref(GITHUB_RAW_URL_PREF)}${repo}/${sha}/${path}`;
}

/**
 * @param {string} repo - "owner/repo"
 * @param {string} folder
 * @param {string} sha
 * @returns {(string|RegExp)[]} Where the mod's files may come from: a
 * renamed repository redirects, and the commit pins what comes back
 */
function gitHubRawPrefixes(repo, folder, sha) {
  const root = Services.prefs.getStringPref(GITHUB_RAW_URL_PREF);
  const path = folder ? `${encodePath(folder)}/` : "";

  return [
    gitHubRawUrl(repo, folder, sha),
    new RegExp(
      `^${root.replace(REGEXP_ESCAPE_RE, "\\$&")}[^/]+/[^/]+/${sha}/${path.replace(REGEXP_ESCAPE_RE, "\\$&")}`
    ),
  ];
}

/**
 * @param {{repo: string, ref: string|null}} source
 * @returns {Promise<string>} The commit the branch points to now
 */
export async function resolveGitHubCommit({ repo, ref }) {
  const api = gitHubApiUrl(repo);
  const response = await download(
    `${api}commits/${encodeURIComponent(ref ?? "HEAD")}`,
    {
      allowed: gitHubApiPrefixes(repo),
      headers: { Accept: "application/vnd.github.sha" },
    }
  );
  const sha = new TextDecoder().decode(response).trim();

  if (!COMMIT_SHA_RE.test(sha)) {
    throw new Error(`[ZenMods]: GitHub returned no commit for ${repo}.`);
  }

  return sha;
}

/**
 * Reads the mod in a commit: which files it has and what its `theme.json`
 * declares. One without `theme.json` is named after its folder or
 * repository.
 *
 * @param {{repo: string, ref: string|null, folder: string}} source
 * @param {string} sha
 * @returns {Promise<object>}
 */
export async function readGitHubCommit({ repo, ref, folder }, sha) {
  if (!COMMIT_SHA_RE.test(sha)) {
    throw new Error(`[ZenMods]: Invalid commit: ${sha}`);
  }

  const api = gitHubApiUrl(repo);
  const treeBytes = await download(`${api}git/trees/${sha}?recursive=1`, {
    allowed: gitHubApiPrefixes(repo),
  });
  const tree = JSON.parse(new TextDecoder().decode(treeBytes));

  if (!Array.isArray(tree?.tree) || tree.truncated) {
    throw new Error(`[ZenMods]: Could not list the files of ${repo}.`);
  }

  const prefix = folder ? `${folder}/` : "";
  const files = tree.tree
    .filter(
      entry =>
        entry?.type === "blob" &&
        typeof entry.path === "string" &&
        entry.path.startsWith(prefix)
    )
    .map(entry => ({
      path: entry.path.slice(prefix.length),
      size: Number(entry.size) || 0,
    }))
    .filter(({ path, size }) => {
      if (size > MAX_FILE_BYTES) {
        console.warn(
          `[ZenMods]: ${path} of ${repo} is larger than ${MAX_FILE_BYTES} bytes, skipping.`
        );

        return false;
      }

      return pathParts(path)?.every(
        part => !part.startsWith(".") && part !== "node_modules"
      );
    });
  const totalBytes = files.reduce((total, { size }) => total + size, 0);

  if (files.length > MAX_REMOTE_FILES || totalBytes > MAX_REMOTE_BYTES) {
    throw new Error(`[ZenMods]: ${repo} is too big for a mod.`);
  }

  const paths = new Set(files.map(({ path }) => path));
  const raw = gitHubRawUrl(repo, folder, sha);
  let declared = {};

  if (paths.has("theme.json")) {
    const bytes = await download(`${raw}theme.json`, {
      allowed: gitHubRawPrefixes(repo, folder, sha),
    });

    declared = JSON.parse(new TextDecoder().decode(bytes));
  }

  const manifest = parseManifest(declared);

  for (const { path } of manifest.scripts) {
    if (!paths.has(path)) {
      throw new Error(`[ZenMods]: Script ${path} is missing.`);
    }
  }

  manifest.stylePath = await findStyle(manifest.stylePath, path =>
    paths.has(path)
  );

  if (manifest.contentStylePath && !paths.has(manifest.contentStylePath)) {
    console.warn(
      `[ZenMods]: ${manifest.contentStylePath} is missing in ${repo}, skipping the mod's page styles.`
    );
    manifest.contentStylePath = null;
  }

  if (
    !manifest.stylePath &&
    !manifest.contentStylePath &&
    !manifest.scripts.length
  ) {
    throw new Error(`[ZenMods]: ${repo} has neither styles nor scripts.`);
  }

  const [owner, repoName] = repo.split("/");

  return {
    ...manifest,
    name: manifest.name || folder.split("/").at(-1) || repoName,
    version: manifest.version || sha.slice(0, 7),
    author: manifest.author || owner,
    homepage: manifest.homepage || `https://github.com/${repo}`,
    preferences: paths.has(manifest.preferencesPath),
    source: "github",
    repo,
    ref,
    folder,
    sha,
    files: [...paths],
  };
}

/**
 * Downloads a GitHub mod's files, as they are in its commit, into a fresh
 * folder next to the installed ones.
 *
 * @param {string} root - The folder that holds downloaded mods
 * @param {string} modId
 * @param {object} found - What `readGitHubCommit` returned
 * @returns {Promise<{mod: object, staging: string}>} The registry entry,
 * with the hash of its scripts, and the folder with the files
 */
export async function stageGitHub(root, modId, found) {
  const { repo, folder, sha, files } = found;

  await IOUtils.makeDirectory(root, { ignoreExisting: true });

  const staging = await IOUtils.createUniqueDirectory(root, ".github.staging");
  const raw = gitHubRawUrl(repo, folder, sha);
  const downloadFile = async path => {
    const target = PathUtils.join(staging, ...pathParts(path));

    const bytes = await download(`${raw}${encodePath(path)}`, {
      allowed: gitHubRawPrefixes(repo, folder, sha),
    });

    await IOUtils.makeDirectory(PathUtils.parent(target), {
      ignoreExisting: true,
    });
    await IOUtils.write(target, bytes);
  };

  const mod = { ...found, id: modId, scriptsHash: null };

  delete mod.files;

  try {
    for (let start = 0; start < files.length; start += PARALLEL_DOWNLOADS) {
      await Promise.all(
        files.slice(start, start + PARALLEL_DOWNLOADS).map(downloadFile)
      );
    }

    if (mod.scripts.length) {
      mod.scriptsHash = await hashScripts(modId, staging);
    }

    await assertLocalStyles(staging, mod.name, [
      mod.stylePath,
      mod.contentStylePath,
    ]);
  } catch (error) {
    await IOUtils.remove(staging, { recursive: true, ignoreAbsent: true });

    throw error;
  }

  return { mod, staging };
}
