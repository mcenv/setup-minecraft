// @ts-check

"use strict";

import { restoreCache, saveCache } from "@actions/cache";
import { getInput, exportVariable, setOutput, info, setFailed } from "@actions/core";
import { HttpClient } from "@actions/http-client";
import { mkdirP } from "@actions/io";
import { downloadTool } from "@actions/tool-cache";
import { createHash } from "crypto";
import { stat, readFile } from "fs/promises";
import { join } from "path";

/**
 * @typedef {{
 *     latest: {
 *         release: string,
 *         snapshot: string
 *     },
 *     versions: [
 *         {
 *             id: string,
 *             type: "release" | "snapshot",
 *             url: string,
 *             time: string,
 *             releaseTime: string,
 *             sha1: string,
 *             complianceLevel: number
 *         }
 *     ]
 * }} VersionManifestV2
 *
 * @typedef {{
 *     downloads: {
 *         server: {
 *             sha1: string,
 *             size: number,
 *             url: string
 *         }
 *     }
 * }} Pack
 */

const VERSION_MANIFEST_URL = "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json";
const CACHE_KEY_PREFIX = "minecraft";
const ROOT_PATH = ".minecraft";
const SERVER_JAR_PATH = join(ROOT_PATH, "server.jar");
const SERVER_JAR_ENV = "MINECRAFT";
const INPUT_VERSION = "version";
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
 * @param {Pack} pack
 */
async function downloadServer(pack) {
  await downloadTool(pack.downloads.server.url, SERVER_JAR_PATH);

  const checkSize = new Promise(async (resolve, reject) => {
    const expectedSize = pack.downloads.server.size;
    const actualSize = (await stat(SERVER_JAR_PATH)).size;
    if (expectedSize === actualSize) {
      resolve(undefined);
    } else {
      reject(`Expected size: ${expectedSize}\nActual size: ${actualSize}`);
    }
  });

  const checkSha1 = new Promise(async (resolve, reject) => {
    const expectedSha1 = pack.downloads.server.sha1;
    const sha1 = createHash("sha1");
    sha1.update(await readFile(SERVER_JAR_PATH));
    const actualSha1 = sha1.digest("hex");
    if (expectedSha1 === actualSha1) {
      resolve(undefined);
    } else {
      reject(`Expected sha1: ${expectedSha1}\nActual sha1: ${actualSha1}`);
    }
  });

  return Promise.all([checkSize, checkSha1]);
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
    if (!versionEntry) {
      throw new Error(`No version '${version}' was found`);
    }

    /** @type {Pack} */
    const pack = await getJson(http, versionEntry.url);

    await mkdirP(ROOT_PATH);

    const key = `${CACHE_KEY_PREFIX}-${version}`;
    const cacheKey = await restoreCache([ROOT_PATH], key, undefined, undefined, true);
    if (cacheKey === undefined) {
      await downloadServer(pack);
      await saveCache([ROOT_PATH], key);
    }

    exportVariable(SERVER_JAR_ENV, SERVER_JAR_PATH);
    setOutput(OUTPUT_VERSION, version);
    setOutput(OUTPUT_PACKAGE, pack);

    info(`Minecraft: ${version}`);
  } catch (error) {
    setFailed(`${error}`);
  }
}

run();
