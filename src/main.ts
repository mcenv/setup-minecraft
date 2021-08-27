import * as cache from "@actions/cache";
import * as core from "@actions/core";
import { HttpClient } from "@actions/http-client";
import * as io from "@actions/io";
import * as tc from "@actions/tool-cache";
import * as fs from "fs";
import * as path from "path";
import { INPUT_VERSION, MINECRAFT, OUTPUT_VERSION, SCRIPT, SERVER, VERSION_MANIFEST_V2_URL } from "./constants";
import type { Version, VersionManifestV2 } from "./types";

async function getJson<T>(http: HttpClient, url: string): Promise<T> {
    const response = await http.get(url);
    const body = await response.readBody();
    return JSON.parse(body);
}

async function run(): Promise<void> {
    try {
        const http = new HttpClient();

        const versionManifest = await getJson<VersionManifestV2>(http, VERSION_MANIFEST_V2_URL);

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
            const targetVersion = await getJson<Version>(http, versionEntry.url);
            await tc.downloadTool(targetVersion.downloads.server.url, path.join(MINECRAFT, SERVER));

            fs.writeFileSync(path.join(MINECRAFT, SCRIPT), `java -jar $(dirname $(realpath $0))/${SERVER} nogui`, { mode: 0o775 });

            await cache.saveCache(paths, key);
        }

        core.addPath(MINECRAFT);
        core.setOutput(OUTPUT_VERSION, version);

        core.info("Minecraft:");
        core.info(`  Version: ${version}`);
    } catch (error) {
        core.setFailed(`${error}`);
    }
}

run();
