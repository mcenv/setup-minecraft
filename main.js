// @ts-check

import * as cache from "@actions/cache";
import * as core from "@actions/core";
import { HttpClient } from "@actions/http-client";
import * as io from "@actions/io";
import * as tc from "@actions/tool-cache";
import * as crypto from "crypto";
import { promises as fs } from "fs";
import * as path from "path";

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
 * }} Version
 */

const VERSION_MANIFEST_V2_URL = "https://launchermeta.mojang.com/mc/game/version_manifest_v2.json";
const MINECRAFT = "minecraft";
const SERVER_JAR = path.join(MINECRAFT, "server.jar");
const INPUT_VERSION = "version";
const OUTPUT_VERSION = "version";

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
 * @param {HttpClient} http
 * @param {string} url
 */
async function download(http, url) {
    /** @type {Version} */
    const version = await getJson(http, url);

    await tc.downloadTool(version.downloads.server.url, SERVER_JAR);

    const checkSize = new Promise(async (resolve, reject) => {
        const expectedSize = version.downloads.server.size;
        const actualSize = (await fs.stat(SERVER_JAR)).size;
        if (expectedSize === actualSize) {
            resolve();
        } else {
            reject(`expected size: ${expectedSize}\nactual size: ${actualSize}`);
        }
    });

    const checkSha1 = new Promise(async (resolve, reject) => {
        const expectedSha1 = version.downloads.server.sha1;
        const sha1 = crypto.createHash("sha1");
        sha1.update(await fs.readFile(SERVER_JAR));
        const actualSha1 = sha1.digest("hex");
        if (expectedSha1 === actualSha1) {
            resolve();
        } else {
            reject(`expected sha1: ${expectedSha1}\nactual sha1: ${actualSha1}`);
        }
    });

    return Promise.all([checkSize, checkSha1]);
}

async function run() {
    try {
        const http = new HttpClient();

        /** @type {VersionManifestV2} */
        const versionManifest = await getJson(http, VERSION_MANIFEST_V2_URL);

        const version = (() => {
            const version = core.getInput(INPUT_VERSION);
            switch (version) {
                case "release":
                    return versionManifest.latest.release;
                case "snapshot":
                    return versionManifest.latest.snapshot;
                default:
                    return version;
            }
        })();

        const versionEntry = versionManifest.versions.find(v => v.id === version);
        if (!versionEntry) {
            throw new Error(`Version '${version}' not found`);
        }

        await io.mkdirP(MINECRAFT);

        const key = `${MINECRAFT}-${version}`;
        const paths = [MINECRAFT];
        const cacheKey = await cache.restoreCache(paths, key);
        if (!cacheKey) {
            await download(http, versionEntry.url);
            await cache.saveCache(paths, key);
        }

        core.setOutput(OUTPUT_VERSION, version);

        core.info("Minecraft:");
        core.info(`  Version: ${version}`);
        core.info(`  Path: ${SERVER_JAR}`)
    } catch (error) {
        core.setFailed(`${error}`);
    }
}

run();
