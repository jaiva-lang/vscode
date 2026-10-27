import { spawn, spawnSync } from "child_process";

import * as Tokens from "./tokens/types";
import * as JaivaLibraries from "./globals";
import { MultiMap } from "../mmap";
import * as Docs from "./tokens/jdoc";
import { Diagnostics } from "../vscodeWrapper";
import * as vscode from "vscode";
import * as path from "path";
import { BetterPath } from "../BetterPath";
import { RepoLib } from "../repos/repos";
import { FilesAndShii } from "../repos/config";

export { Tokens, JaivaLibraries, Docs };

export type InterprterStr = "ERR_INTERP" | "ERR_INTERP_DIED" | "INTERP_SUCCESS";

export type StreamerOutput = {
    streamer: true;
    message: string;
    lineNumber: number;
    type: "ERR_STREAMER" | "ERR_TOKENS" | InterprterStr;
};

export type Warning = {
    message: string;
    lineNumber: number;
};

export type InterpreterOutput = {
    warnings: Warning[];
    scope: string;
    type: InterprterStr;
} & StreamerOutput;

class Base {
    private d: Diagnostics | null = null;

    public uses(d: Diagnostics) {
        this.d = d;
    }

    protected getDiagnostics(): Diagnostics | null {
        return this.d;
    }

    public release(): void {}
}

export enum Context {
    NORMAL,
    IMPORT,
}

export class SharedValues extends Base {
    private tokenList: Tokens.TokenDefault[] = [];
    private readCopy: Tokens.TokenDefault[] = [];
    private libraryMap: Map<string, JaivaLibraries.Library> = new Map();
    private externalFileCLI: JaivaCLI = new JaivaCLI();
    public definitionsMap: MultiMap<string, Tokens.TokenDefault> =
        new MultiMap();

    constructor() {
        super();
    }

    public loadLibrariesExternal(
        vscode: typeof import("vscode"),
        vers: string,
        repoBasePath: BetterPath,
        ...libFiles: RepoLib[]
    ): void {
        libFiles.forEach((lib) => {
            const load = JaivaLibraries.loadFrom(repoBasePath, lib);
            let libTitle = lib.path;
            console.log("Loaded " + libTitle);

            if (load.version !== vers) {
                const str =
                    "Expected " +
                    libTitle +
                    " to be of version " +
                    vers +
                    ". Instead got " +
                    load.version;
                vscode.window.showInformationMessage(str + ".");
                return;
            }

            this.libraryMap.set(libTitle, load);
        });
    }

    public loadLibraries(
        vscode: typeof import("vscode"),
        vers: string,
        context: import("vscode").ExtensionContext,
    ): void {
        const globals = [
            "globals",
            "debug",
            "math",
            "types",
            "types/numbers",
            "math/base",
            "math/const",
            "math/trig",
            "file",
            "file/text",
            "file/text/query",
            "arrays",
            "time",
            "time/api",
            "time/zone",
            "threads",
            "file/bytes",
            "file/bytes/const",
            "continuous",
            "reflect",
            "net",
            "net/const",
            "net/tcp",
            "net/interf",
            "net/interf/query",
        ];

        globals.forEach((lib) => {
            const load = JaivaLibraries.load(lib, context);
            console.log("Loaded " + lib);

            if (load.version !== vers) {
                const str =
                    "Expected " +
                    lib +
                    " to be of version " +
                    vers +
                    ". Instead got " +
                    load.version;
                vscode.window.showInformationMessage(str + ".");
                return;
            }

            this.libraryMap.set(lib, load);
        });
    }

    public err(doc: vscode.TextDocument, str: string): void {
        try {
            let any = JSON.parse(str);
            if (Tokens.hasPropertyOf<StreamerOutput>(any, "streamer")) {
                any.lineNumber = any.lineNumber == -1 ? 1 : any.lineNumber;
                if (this.getDiagnostics()) {
                    this.getDiagnostics()?.err(doc, any);
                }
                return;
            }
        } catch (error) {
            console.log(error);
            return;
        }
    }

    public write(doc: vscode.TextDocument, str: string): void {
        const arr = this.parse(str, Context.NORMAL, doc);
        if (arr == null) return;
        this.tokenList = arr;
        const globals = this.loadLibraryAt(null, "globals", -1, doc);
        this.tokenList.push(...globals);
        this.readCopy = [...this.tokenList];
    }

    public parse(str: string, context: Context, doc: vscode.TextDocument) {
        let any;
        try {
            any = JSON.parse(str);
            if (Tokens.hasPropertyOf<StreamerOutput>(any, "streamer")) {
                // if (this.getDiagnostics()) {
                //     this.getDiagnostics()?.err(doc, any);
                // }
                return null;
            }
        } catch (error) {
            console.log(error);
            return null;
        }
        if (!str.startsWith("[")) return null;

        const arr = any as any[];
        return this.add(-1, arr, context, doc);
    }

    private normalize(doc: vscode.TextDocument, str: string): string {
        return path.resolve(path.dirname(doc.uri.fsPath), str);
    }
    private loadLibraryAt(
        importTok: null | Tokens.ImportToken,
        name: string,
        range: Tokens.LineRange,
        doc: vscode.TextDocument,
    ): Tokens.TokenDefault[] {
        const fromLib = importTok?.isLib || importTok == null;
        var tokens = fromLib
            ? (this.libraryMap.get(name)?.tokens ?? [])
            : (this.parse(
                  this.externalFileCLI.callSync(
                      this.normalize(doc, importTok?.filePath),
                  ),
                  Context.IMPORT,
                  doc,
              ) ?? []);
        var newTokens: any[] = [];
        if (importTok !== null) {
            const str = "\n\n_Imported from " + importTok.fileName + "_";
            (tokens as Tokens.TokenDefault[]).forEach((t) => {
                const n = t.name.startsWith("F~") ? t.name.slice(2) : t.name;
                t = {
                    ...t,
                    importedFromLine: importTok.lineNumber,
                } as Tokens.TokenDefault & Tokens.ImportedFrom;
                if (importTok.symbols.length > 0) {
                    if (!importTok.symbols.includes(n)) {
                        t.within = [importTok.lineNumber, importTok.lineNumber];
                    }
                }
                t.lineNumber = -1;
                if (typeof t.toolTip === "string") {
                    if (!t.toolTip.includes(str)) t.toolTip += "\n" + str;
                } else {
                    const arr = t.toolTip;
                    let doc = arr.find((c) => {
                        if (c.tagType === "GENERIC") return c;
                    });
                    if (doc == undefined) {
                        doc = {
                            tagType: "GENERIC",
                            description: str,
                        } as Docs.GenericDoc;
                    } else {
                        if (!(doc as Docs.GenericDoc).description.includes(str))
                            (doc as Docs.GenericDoc).description += "\n" + str;
                    }
                }

                newTokens.push(t);
            });
        }
        return this.add(
            range,
            newTokens.length == 0 ? tokens : newTokens,
            fromLib ? Context.NORMAL : Context.IMPORT,
            doc,
        );
    }

    private add(
        parentRange: Tokens.LineRange,
        arr: any[],
        context: Context = Context.NORMAL,
        doc: vscode.TextDocument,
    ): Tokens.TokenDefault[] {
        const tokens: Tokens.TokenDefault[] = [];
        for (let token of arr) {
            if (Tokens.hasPropertyOf<Tokens.TokenDefault>(token, "type")) {
                const out = Tokens.toScopedToken(token);
                if (out === null) {
                    // normal token. cast and add.
                    if (Tokens.isTheTokensWeNeed(token)) {
                        if (context === Context.IMPORT) {
                            if (
                                Tokens.hasPropertyOf<Tokens.SymbolToken>(
                                    token,
                                    "exportSymbol",
                                )
                            ) {
                                if (!token.exportSymbol) continue;
                            } else {
                                continue;
                            }
                        }
                        if (!("within" in token))
                            token = {
                                ...(token as Tokens.TokenDefault),
                                within: parentRange,
                            } as Tokens.TokenDefault;
                        // else token.within = parentRange;
                        tokens.push(token);

                        if (
                            Tokens.hasPropertyOf<Tokens.ImportToken>(
                                token,
                                "isLib",
                            )
                        ) {
                            const a = this.loadLibraryAt(
                                token,
                                token.fileName,
                                parentRange,
                                doc,
                            );
                            // check if is a isLib is true
                            // if (token.isLib) {
                            tokens.push(...a);
                            // } else {
                            //     // if this runs, the lib basically exists.
                            //     tokens.push;
                            // }
                        }
                    }
                } else {
                    const [scoped, otherTokens] = out;
                    if (context === Context.IMPORT) {
                        if (
                            Tokens.hasPropertyOf<Tokens.TFunction>(
                                token,
                                "exportSymbol",
                            )
                        ) {
                            if (!token.exportSymbol) continue;
                        } else {
                            continue;
                        }
                    }
                    scoped.within = parentRange;
                    tokens.push(scoped);
                    const other = this.others(scoped, [
                        scoped.lineNumber,
                        scoped.lineEnd,
                    ]);
                    tokens.push(...other);
                    if (context !== Context.IMPORT) {
                        otherTokens.forEach((t) => {
                            // blocks
                            const arr2 = this.add(
                                t[0],
                                t[1],
                                Context.NORMAL,
                                doc,
                            );
                            tokens.push(...arr2);
                        });
                    }
                }

                this.definitionsMap.add(
                    token.type === "TFunction"
                        ? token.name.slice(2)
                        : token.name,
                    token,
                );
            }
        }
        return tokens;
    }

    private others(
        scoped: Tokens.ScopedToken,
        lineRange: Tokens.LineRange,
    ): Tokens.TokenDefault[] {
        if (Tokens.hasPropertyOf<Tokens.TForLoop>(scoped, "variable")) {
            // TForLoop contributes a variable to the scope. We need to add that variable to the list of tokens.
            // contributes iterator
            if (scoped.arrayVariable === null) {
                const tok = scoped.variable as Tokens.TokenDefault;
                tok.toolTip =
                    "Colonize Loop Iterator Variable - Line " +
                    scoped.lineNumber +
                    "\n```jaiva\n" +
                    tok.name +
                    "\n```\n";
                tok.within = lineRange;
                const special: Tokens.SpecialToken = {
                    ...tok,
                    sortText: "1_",
                };
                this.definitionsMap.add(special.name, special);
                return [special];
            } else if (scoped.arrayVariable !== null) {
                const tok = scoped.variable as Tokens.TokenDefault;
                tok.toolTip =
                    "Colonize Loop Array Variable - Line " +
                    scoped.lineNumber +
                    "\n```jaiva\n" +
                    tok.name +
                    "\n```\n";
                tok.within = lineRange;
                const out: Tokens.SpecialToken = {
                    ...tok,
                    sortText: "1_",
                };
                this.definitionsMap.add(out.name, out);
                return [out];
            }
        } else if (
            Tokens.hasPropertyOf<Tokens.TTryCatchStatement>(
                scoped,
                "catchProperties",
            )
        ) {
            const all = this.readCopy.filter((t) => {
                if (t.type === "TFunction") return false;

                if (t.name.includes("error")) return true;
                return false;
            });
            const catchProperties = scoped.catchProperties;
            const name = "error" + (all.length == 0 ? "" : all.length);
            const allFromDef = this.definitionsMap.get(name);

            if (
                all.find(
                    (t) =>
                        // t.name.includes(name) ||
                        t.name === name && t.within === catchProperties,
                ) != undefined
            )
                return [];

            const tok: Tokens.SpecialToken = {
                type: "TUnknownScalar",
                lineNumber: catchProperties[0],
                toolTip:
                    "Chaai Block Error Variable (This could be inaccurate) - Line " +
                    catchProperties[0],
                name:
                    "error" + (allFromDef.length == 0 ? "" : allFromDef.length),
                within: catchProperties,
                sortText: "1_",
            };

            this.definitionsMap.add(tok.name, tok);
            return [tok];
        } else if (Tokens.hasPropertyOf<Tokens.TFunction>(scoped, "args")) {
            const tokens: Tokens.TokenDefault[] = [];
            // try to find the arg docs in JDoc
            // add the arguments of the function
            scoped.args.forEach((arg, index) => {
                const isFunction = arg.startsWith("F~");
                const isOptional = scoped.isArgOptional[index];
                const name = isFunction ? arg.slice(2) : arg;

                const doc = scoped.toolTip;
                let str =
                    "Function parameter of " +
                    scoped.name +
                    " on line " +
                    scoped.lineNumber;
                if (typeof doc !== "string") {
                    const jdoc = doc as Docs.JDoc[];
                    // filter and find by arg name
                    const found = doc.find((d) => {
                        if (
                            Tokens.hasPropertyOf<Docs.ParameterDoc>(
                                d,
                                "tagType",
                            ) &&
                            d.var === name
                        )
                            return d;
                    }) as Docs.ParameterDoc;
                    if (found !== undefined) {
                        str =
                            "_(From `" +
                            scoped.name +
                            "()`'s documentation)_ : " +
                            found.description;
                    }
                }

                const argument: Tokens.FunctionArgument = {
                    name,
                    lineNumber: scoped.lineNumber,
                    within: lineRange,
                    sortText: "0_",
                    argumentType: isFunction
                        ? "F~"
                        : scoped.varArgs
                          ? "<-"
                          : "V~",
                    type: "TUnknownScalar",
                    toolTip:
                        str +
                        "\n" +
                        (!isOptional
                            ? ""
                            : "> This parameter is marked as optional. Meaning it may possibly hold a value " +
                              "of `idk`."),
                };
                this.definitionsMap.add(argument.name, argument);
                tokens.push(argument);
            });
            return tokens;
        }
        return [];
    }

    public read(): Tokens.TokenDefault[] {
        return this.readCopy;
    }

    public release(): void {
        this.externalFileCLI.release();
    }

    public getLibrary(name: string): JaivaLibraries.Library | undefined {
        return this.libraryMap.get(name);
    }
}

export class JaivaCLI extends Base {
    private child;
    private buffer = "";
    private pending: ((data: string) => void)[] = [];

    constructor() {
        super();
        this.child = spawn("jaiva", ["--json-stream"], { shell: true });

        this.child.stdout.on("data", (chunk) => {
            this.buffer += chunk.toString();

            // Example: assume each response ends with a newline
            let lines = this.buffer.split("\n");
            this.buffer = lines.pop() || ""; // keep incomplete line

            for (const line of lines) {
                const resolver = this.pending.shift();
                if (resolver) resolver(line);
            }
        });

        this.child.stderr.on("data", (chunk) => {
            console.error("Jaiva STDERR:", chunk.toString());
        });

        this.child.on("error", (err) => {
            console.error("Jaiva process error:", err);
        });

        this.child.on("close", (code) => {
            console.log(`Jaiva exited with code ${code}`);
            if (code != 0) {
                vscode.window
                    .showErrorMessage(
                        "Jaiva crashed! Please reload your window",
                        "Reload",
                    )
                    .then((sel) => {
                        if ((sel = "Reload")) {
                            vscode.commands.executeCommand(
                                "workbench.action.reloadWindow",
                            );
                        }
                    });
            }
        });
    }

    public release(): void {
        if (this.child.killed) return;

        this.child.stdin.end();
        this.child.kill();
    }

    public callSync(path: string): string {
        const result = spawnSync("jaiva", ["-js", "-e", path], {
            shell: true,
            encoding: "utf8",
        });

        if (result.error) {
            throw result.error;
        }

        return result.stdout;
    }

    async call(args: string[]): Promise<string> {
        return new Promise((resolve) => {
            this.pending.push(resolve);
            this.child.stdin.write(args.join(" ") + "\n");
        });
    }
}
