import * as path from "node:path";
import * as vscode from "vscode";

export class BetterPath {
    private root: string;
    private segments: string[];

    private constructor(root: string | vscode.Uri, ...segments: string[]) {
        this.root = typeof root === "string" ? root : root.fsPath;
        this.segments = segments;
    }

    /**
     * @param root Accepts a string path or a vscode.Uri (e.g., context.globalStorageUri)
     * @param segments Unlimited relative path segments to join
     */
    public static of(
        root: string | vscode.Uri,
        ...segments: string[]
    ): BetterPath {
        return new BetterPath(root, ...segments);
    }

    /**
     * Appends additional segments and returns a new ExtensionPath instance
     */
    public join(...newSegments: string[]): BetterPath {
        return new BetterPath(this.root, ...this.segments, ...newSegments);
    }

    /**
     * Resolves the full string path
     */
    public toString(): string {
        return path.join(this.root, ...this.segments);
    }

    /**
     * Resolves and returns the target as a vscode.Uri
     */
    public toUri(): vscode.Uri {
        return vscode.Uri.file(this.toString());
    }

    public last(): string;
    public last(mutator: (a: string) => string): string;
    public last(mutator?: (a: string) => string): string {
        let s = this.segments[this.segments.length - 1];

        return mutator ? mutator(s) : s;
    }
}
