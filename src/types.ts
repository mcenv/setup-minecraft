export type VersionManifestV2 = {
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
};

export type Version = {
    downloads: {
        server: {
            sha1: string,
            size: number,
            url: string
        }
    }
};
