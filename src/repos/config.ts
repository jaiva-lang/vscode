import * as vscode from "vscode";
import { BetterPath } from "../utils";
import { RepoConfig } from "./repos";

export type Config = {
    /**
     * The folders where the repos themselves are
     */
    folders: string[];
};

export class FilesAndShii {
    protected rootPath: vscode.Uri;

    constructor(context: vscode.ExtensionContext) {
        this.rootPath = context.globalStorageUri;
    }

    public async constr() {
        await vscode.workspace.fs.createDirectory(this.rootPath);
        await FilesAndShii.touchFolders(BetterPath.of(this.rootPath, "repos"));
        await FilesAndShii.touchFiles(
            BetterPath.of(this.rootPath, "config.json"),
        );
    }

    public getRootPath(): vscode.Uri {
        return this.rootPath;
    }

    public async readConfig(): Promise<Config> {
        const configPath = BetterPath.of(this.rootPath, "config.json");
        const content = await FilesAndShii.readFile(configPath);
        if (content === "") {
            return {
                folders: [],
            } as Config;
        }
        return JSON.parse(content) as Config;
    }

    public async writeConfig(c: Config): Promise<void> {
        const configPath = BetterPath.of(this.rootPath, "config.json");
        const content = JSON.stringify(c);

        await FilesAndShii.writeFile(configPath, content);
    }

    public async touchRepoFolder(repoId: string): Promise<BetterPath> {
        const bp = BetterPath.of(this.rootPath, "repos", repoId);
        await FilesAndShii.touchFolders(bp);
        return bp;
    }

    public getRepoFolder(repoId: string): BetterPath {
        const bp = BetterPath.of(this.rootPath, "repos", repoId);
        return bp;
    }

    public async readRepo(repoId: string): Promise<RepoConfig> {
        const repoFolderPath = BetterPath.of(this.rootPath, "repos", repoId);
        const repoConfigPath = repoFolderPath.join("repo.json");
        const content = await FilesAndShii.readFile(repoConfigPath);
        return JSON.parse(content) as RepoConfig;
    }

    public static async writeFile(
        p: BetterPath,
        content: string,
    ): Promise<void> {
        await vscode.workspace.fs.writeFile(
            p.toUri(),
            Buffer.from(content, "utf8"),
        );
    }

    public static async readFile(p: BetterPath): Promise<string> {
        const data = await vscode.workspace.fs.readFile(p.toUri());

        return Buffer.from(data).toString("utf8");
    }

    private static async touchFolders(
        ...folderPaths: BetterPath[]
    ): Promise<void> {
        await Promise.all(
            folderPaths.map(async (folder) => {
                await vscode.workspace.fs.createDirectory(folder.toUri());
            }),
        );
    }

    private static async touchFiles(...filePaths: BetterPath[]): Promise<void> {
        for (const file of filePaths) {
            try {
                await vscode.workspace.fs.stat(file.toUri());
            } catch {
                await vscode.workspace.fs.writeFile(
                    file.toUri(),
                    Buffer.from("", "utf8"),
                );
            }
        }
    }
}
