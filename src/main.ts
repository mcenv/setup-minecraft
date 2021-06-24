import { getInput, info, setFailed, setOutput } from "@actions/core";
import { restoreCache, saveCache } from "@actions/cache";
import * as fs from "fs";
import * as https from "https";
import * as path from "path";
import { INPUT_VERSION, MINECRAFT, OUTPUT_VERSION, VERSION_MANIFEST_V2_URL } from "./constants";

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

async function downloadServer(url: string): Promise<void> {
    info(`Downloading server.jar from ${url} ...`);

    const file = path.join(MINECRAFT, "server.jar");
    return new Promise((resolve, reject) => https.get(url, res => {
        res
            .pipe(fs.createWriteStream(file))
            .on("finish", () => resolve())
            .on("error", error => reject(error));
    }));
}

async function run(): Promise<void> {
    try {
        fs.mkdirSync(MINECRAFT, { recursive: true });

        const versionManifest = await getJson<VersionManifestV2>(VERSION_MANIFEST_V2_URL);

        let version = getInput(INPUT_VERSION);
        switch (version) {
            case "release":
                version = versionManifest.latest.release;
                break;
            case "snapshot":
                version = versionManifest.latest.snapshot;
                break;
        }

        const versionEntry = versionManifest.versions.find(v => v.id === version);
        if (!versionEntry) {
            throw Error(`Version ${version} not found`);
        }

        const key = `${MINECRAFT}-${versionEntry.id}`;
        const paths = [MINECRAFT];
        const cacheKey = await restoreCache(paths, key);
        if (!cacheKey) {
            const targetVersion = await getJson<Version>(versionEntry.url);
            await downloadServer(targetVersion.downloads.server.url);
            await saveCache(paths, key);
        }

        setOutput(OUTPUT_VERSION, version);

        info("Minecraft:");
        info(`  Version: ${version}`);
        info(`  Path: ${MINECRAFT}`);
    } catch (error) {
        setFailed(error.message);
    }
}

run();
