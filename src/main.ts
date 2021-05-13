import { setFailed } from "@actions/core";
import { restoreCache, saveCache } from "@actions/cache";
import { createWriteStream } from "fs";
import { mkdir } from "fs/promises";
import * as https from "https";
import { dirname } from "path";

const versionManifestV2Url = "https://launchermeta.mojang.com/mc/game/version_manifest_v2.json";

interface VersionManifestV2 {
    latest: {
        release: string,
        snapshot: string
    },
    versions: [
        {
            id: string,
            type: "release" | "snapshot",
            url: string,
            time: string,
            releaseTime: string,
            sha1: string,
            complianceLevel: number
        }
    ]
}

interface Version {
    downloads: {
        server: {
            sha1: string,
            size: number,
            url: string
        }
    }
}

async function getJson<T>(url: string): Promise<T> {
    return new Promise(resolve => https.get(url, res => {
        let data = "";
        res
            .on("data", chunk => data += chunk)
            .on("end", () => resolve(JSON.parse(data)));
    }));
}

async function download(path: string, url: string): Promise<void> {
    await mkdir(dirname(path), { recursive: true });
    return new Promise(resolve => https.get(url, res => {
        res
            .pipe(createWriteStream(path))
            .on("end", () => resolve());
    }));
}

async function run() {
    try {
        const versionManifest = await getJson<VersionManifestV2>(versionManifestV2Url);
        const latestSnapshot = versionManifest.latest.snapshot;
        const latestVersion = versionManifest.versions.find(version => version.id === latestSnapshot)!;

        const key = `minecraft-${latestVersion.id}`;
        const paths = ["minecraft"];
        const cacheKey = await restoreCache(paths, key);

        if (!cacheKey) {
            const version = await getJson<Version>(latestVersion.url);
            await download("minecraft/server.jar", version.downloads.server.url);
            await saveCache(paths, key);
        }
    } catch (error) {
        setFailed(error.message);
    }
}

run();
