// @ts-check

"use strict";

import { restoreCache, saveCache } from "@actions/cache";
import { getInput, exportVariable, setOutput, info, setFailed, getBooleanInput } from "@actions/core";
import { HttpClient } from "@actions/http-client";
import { mkdirP } from "@actions/io";
import { downloadTool } from "@actions/tool-cache";
import { createHash } from "crypto";
import { statSync, readFileSync } from "fs";
import { resolve } from "path";

/**
 * @typedef {{
 *   latest: {
 *     release: string,
 *     snapshot: string
 *   },
 *   versions: [
 *     {
 *       id: string,
 *       type: "release" | "snapshot",
 *       url: string,
 *       time: string,
 *       releaseTime: string,
 *       sha1: string,
 *       complianceLevel: number
 *     }
 *   ]
 * }} VersionManifestV2
 *
 * @typedef {{
 *   downloads: {
 *     server: {
 *       sha1: string,
 *       size: number,
 *       url: string
 *     }
 *   }
 * }} Pack
 */

const VERSION_MANIFEST_URL = "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json";
const CACHE_KEY_PREFIX = "minecraft";
const ROOT_PATH = ".minecraft";
const SERVER_JAR_PATH = resolve(ROOT_PATH, "server.jar");
const SERVER_JAR_ENV = "MINECRAFT";
const INPUT_VERSION = "version";
const INPUT_INSTALL = "install";
const INPUT_CACHE = "cache";
const INPUT_RETRIES = "retries";
const OUTPUT_VERSION = "version";
const OUTPUT_PACKAGE = "package";

/**
 * @template T
 * @param {HttpClient} http
 * @param {string} url
 * @returns {Promise<T>}
 */
async function getJson(http, url) {
  const response = await http.get(url);
  const body = await response.readBody();
  return JSON.parse(body);
}

/**
 * @param {number} count 
 * @param {() => Promise<void>} action
 */
async function retry(count, action) {
  for (let i = count; i > 0; i--) {
    try {
      await action();
    } catch (error) {
      if (i === 1) {
        throw error;
      }
    }
  }
}

/**
 * @param {Pack} pack
 */
async function downloadServer(pack) {
  await downloadTool(pack.downloads.server.url, SERVER_JAR_PATH);

  {
    const expectedSize = pack.downloads.server.size;
    const actualSize = statSync(SERVER_JAR_PATH).size;
    if (expectedSize !== actualSize) {
      throw new Error(`Expected size: ${expectedSize}\nActual size: ${actualSize}`);
    }
  }

  {
    const expectedSha1 = pack.downloads.server.sha1;
    const sha1 = createHash("sha1");
    sha1.update(readFileSync(SERVER_JAR_PATH));
    const actualSha1 = sha1.digest("hex");
    if (expectedSha1 !== actualSha1) {
      throw new Error(`Expected sha1: ${expectedSha1}\nActual sha1: ${actualSha1}`);
    }
  }
}

async function run() {
  try {
    const http = new HttpClient();

    /** @type {VersionManifestV2} */
    const versionManifest = await getJson(http, VERSION_MANIFEST_URL);

    let version = getInput(INPUT_VERSION);
    switch (version) {
      case "release":
        version = versionManifest.latest.release;
        break;
      case "snapshot":
        version = versionManifest.latest.snapshot;
        break;
      default:
    }

    const versionEntry = versionManifest.versions.find(v => v.id === version);
    if (versionEntry === undefined) {
      throw new Error(`No version '${version}' was found`);
    }

    /** @type {Pack} */
    const pack = await getJson(http, versionEntry.url);

    await mkdirP(ROOT_PATH);

    const install = getBooleanInput(INPUT_INSTALL);
    if (install) {
      const key = `${CACHE_KEY_PREFIX}-${version}`;
      const cacheKey = await restoreCache([ROOT_PATH], key, undefined, undefined, true);
      if (cacheKey === undefined) {
        const retries = parseInt(getInput(INPUT_RETRIES));
        await retry(retries, () => downloadServer(pack));

        const cache = getBooleanInput(INPUT_CACHE);
        if (cache) {
          await saveCache([ROOT_PATH], key);
        }
      }

      exportVariable(SERVER_JAR_ENV, SERVER_JAR_PATH);
    }

    setOutput(OUTPUT_VERSION, version);
    setOutput(OUTPUT_PACKAGE, pack);

    info(`Minecraft: ${version}`);
  } catch (error) {
    setFailed(`${error}`);
  }
}

run();
