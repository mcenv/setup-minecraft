import { getInput, setFailed, setOutput } from "@actions/core";
import { restoreCache, saveCache } from "@actions/cache";
import { createWriteStream } from "fs";
import { mkdir, writeFile } from "fs/promises";
import * as https from "https";
import { dirname } from "path";
import { INPUT_EULA, INPUT_VERSION, MINECRAFT, OUTPUT_VERSION, VERSION_MANIFEST_V2_URL } from "./constants";

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
    const path = `${MINECRAFT}/server.jar`;
    await mkdir(dirname(path), { recursive: true });
    return new Promise(resolve => https.get(url, res => {
        res
            .pipe(createWriteStream(path))
            .on("end", () => resolve());
    }));
}

async function writeEula(eula: boolean): Promise<void> {
    const path = `${MINECRAFT}/eula.txt`
    await mkdir(dirname(path), { recursive: true });
    return writeFile(path, `eula=${eula}`);
}

async function run(): Promise<void> {
    try {
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

        const eula = getInput(INPUT_EULA) === "true";
        await writeEula(eula);

        setOutput(OUTPUT_VERSION, versionEntry.id);
    } catch (error) {
        setFailed(error.message);
    }
}

run();
