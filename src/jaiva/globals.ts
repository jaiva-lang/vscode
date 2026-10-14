import * as T from "./tokens/types";
import * as fs from "fs";
import * as path from "path";
import { BetterPath } from "../BetterPath";
import { FilesAndShii } from "../repos/config";
import { RepoLib } from "../repos/repos";

export type Library = {
    version: string;
    tokens: any[];
};

export type LoadedLibrary = {
    tokens: T.TokenDefault[];
};

export function load(
    file: string,
    context: import("vscode").ExtensionContext,
): Library {
    if (file.includes("/")) file = file.replace("/", "-").replace("/", "-");
    const f = path.join(context.extensionPath, "data", file + ".json");

    const content = fs.readFileSync(f, "utf-8");
    const data = JSON.parse(content) as Library;

    return data;
}

export function loadFrom(repoBasePath: BetterPath, f: RepoLib): Library {
    const filePath = repoBasePath.join(f.file);
    const file = BetterPath.of(filePath.toString());
    const content = fs.readFileSync(file.toString(), "utf-8");
    const data = JSON.parse(content) as Library;

    return data;
}
