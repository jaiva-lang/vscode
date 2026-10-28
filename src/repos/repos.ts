import { JSONObject } from "../utils";
import { FilesAndShii } from "./config";

export type RepoConfig = {
    /**
     * The normal github link
     */
    apiProviderUrl: string;
    /**
     * The GitHub repository title.
     */
    repo: string;
    /**
     * Repo owner
     */
    owner: string;
    /**
     * where the key is the library title, and the value is the actual file location relative
     * to this config file
     */
    libraries: RepoLib[];
    /**
     * The version of Jaiva which these libraries where generated from
     */
    version: string;
};

export type RepoLib = {
    path: string;
    file: string;
};

type JaivaJSON = {
    libTitle: string;
    fileName: string;
    version: string;
    content: JSONObject;
};

type RepositoryFetchMetadata = {
    /**
     * The repo id, being (owner)-(repoName). This is also the folder in /repos/
     */
    repoId: string;
    owner: string;
    repoName: string;
    /**
     * usually JaivaJSON has the same version as defined from fetch.properties, but this is jsut convenience.
     */
    version: string;
    libraries: JaivaJSON[];
};
export class Repositories {
    static async repoExists(
        files: FilesAndShii,
        str: string,
    ): Promise<boolean> {
        const config = await files.readConfig();
        return config.folders.includes(str);
    }

    private async fetchRepository(
        url: string,
        files: FilesAndShii,
        checkExists: boolean = true,
    ): Promise<RepositoryFetchMetadata> {
        const githubUrl = new URL(url);

        if (githubUrl.hostname !== "github.com") {
            throw new Error("URL is not a GitHub repository.");
        }

        const parts = githubUrl.pathname
            .split("/")
            .filter((part) => part.length > 0);

        if (parts.length < 2) {
            throw new Error("URL is not a GitHub repository.");
        }

        const owner = parts[0];
        const repo = parts[1].replace(/\.git$/, "");

        const response = await fetch(
            `https://api.github.com/repos/${owner}/${repo}`,
            {
                headers: {
                    Accept: "application/vnd.github+json",
                },
            },
        );

        if (!response.ok) {
            throw new Error(
                `GitHub repository could not be accessed (${response.status}).`,
            );
        }

        const repository = (await response.json()) as JSONObject;

        if (repository.private) {
            throw new Error("Repository is private.");
        }

        const repositoryName: string = repository.name as string;

        const repoId = owner + "-" + repositoryName;

        if (checkExists) {
            // check if this repo already exists
            const repoExistsResult = await Repositories.repoExists(
                files,
                repoId,
            );

            if (repoExistsResult) {
                throw new Error("Repository already exists.");
            }
        }

        const propertiesResponse = await fetch(
            `https://api.github.com/repos/${owner}/${repo}/contents/jaiva/fetch.properties`,
            {
                headers: {
                    Accept: "application/vnd.github.raw+json",
                },
            },
        );

        if (!propertiesResponse.ok) {
            throw new Error(
                "Repository does not contain /jaiva/fetch.properties.",
            );
        }

        const propertiesText = await propertiesResponse.text();

        const properties = new Map<string, string>();

        for (const line of propertiesText.split(/\r?\n/)) {
            const trimmed = line.trim();

            if (
                trimmed.length === 0 ||
                trimmed.startsWith("#") ||
                trimmed.startsWith("!")
            ) {
                continue;
            }

            const separator = trimmed.indexOf("=");

            if (separator === -1) {
                continue;
            }

            const key = trimmed.substring(0, separator).trim();
            const value = trimmed.substring(separator + 1).trim();

            properties.set(key, value);
        }

        const version = properties.get("version");

        if (!version) {
            throw new Error("fetch.properties does not contain a version.");
        }

        const libraries: JaivaJSON[] = [];

        for (const [libTitle, fileName] of properties) {
            if (libTitle === "version") {
                continue;
            }

            const fileResponse = await fetch(
                `https://api.github.com/repos/${owner}/${repo}/contents/jaiva/${fileName}`,
                {
                    headers: {
                        Accept: "application/vnd.github.raw+json",
                    },
                },
            );

            if (!fileResponse.ok) {
                throw new Error(`Could not read /jaiva/${fileName}.`);
            }

            const content = (await fileResponse.json()) as JSONObject;

            libraries.push({
                libTitle,
                fileName,
                version,
                content,
            });
        }

        return {
            libraries,
            version,
            repoId,
            owner,
            repoName: repositoryName,
        };
    }

    public async add(repoUrl: string, files: FilesAndShii): Promise<void> {
        const m = await this.fetchRepository(repoUrl, files); // implicity check if repo exists
        // get the config and add something to it and save
        const oldConfig = await files.readConfig();
        oldConfig.folders.push(m.repoId);
        await files.writeConfig(oldConfig);
        // touch the folder
        const repoFolderPath = await files.touchRepoFolder(m.repoId);
        // write repo config file
        const libraries: RepoLib[] = [];
        for (const v of m.libraries) {
            libraries.push({
                path: v.libTitle,
                file: v.fileName,
            });

            await FilesAndShii.writeFile(
                repoFolderPath.join(v.fileName),
                JSON.stringify(v.content),
            );
        }

        const repoConfig: RepoConfig = {
            apiProviderUrl: repoUrl,
            owner: m.owner,
            repo: m.repoName,
            version: m.version,
            libraries,
        };

        await FilesAndShii.writeFile(
            repoFolderPath.join("repo.json"),
            JSON.stringify(repoConfig),
        );
    }

    public async getAll(files: FilesAndShii): Promise<RepoConfig[]> {
        const config = await files.readConfig();
        const repoConfigs: RepoConfig[] = [];

        const repos = config.folders;
        for (const repoFolder of repos) {
            const repoConfig = await files.readRepo(repoFolder);
            repoConfigs.push(repoConfig);
        }

        return repoConfigs;
    }
}
