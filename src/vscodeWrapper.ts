import * as v from "vscode";
import * as j from "./jaiva/jaiva";
import {
    hasPropertyOf,
    ImportedFrom,
    TokenDefault,
} from "./jaiva/tokens/types";
import { MultiMap } from "./mmap";

export class AllHandler {
    public shared: j.SharedValues;
    public cli: j.JaivaCLI;
    public completions: Completions = new Completions();
    private version: string;
    public diagnostics: Diagnostics;
    private identificationProvider: IdentificationProvider =
        new IdentificationProvider();

    private debounceTimer?: NodeJS.Timeout;

    constructor(
        version: string,
        shared: j.SharedValues,
        cli: j.JaivaCLI,
        diagnostic: Diagnostics,
    ) {
        this.version = version;
        this.diagnostics = diagnostic;
        shared.uses(this.diagnostics);
        this.shared = shared;
        cli.uses(this.diagnostics);
        this.cli = cli;
    }

    public begin(vscode: typeof v, context: v.ExtensionContext) {
        vscode.workspace.onDidOpenTextDocument((d) => {
            this.docParse(d);
        });
        vscode.workspace.onDidChangeTextDocument((event) => {
            // this.docParse(event.document);
            this.diagnostics.clear(event.document);
        });
        vscode.workspace.onDidSaveTextDocument((event) => {
            this.docParse(event);
        });
        const handler = this;
        vscode.languages.registerCompletionItemProvider("jaiva", {
            provideCompletionItems(document, pos) {
                return handler.completions.provide(
                    handler.shared,
                    document,
                    pos,
                );
            },
        });
        vscode.languages.registerHoverProvider("jaiva", {
            provideHover(doc, pos) {
                return handler.identificationProvider.provideDocs(
                    handler.shared,
                    doc,
                    pos,
                );
            },
        });
        vscode.languages.registerDefinitionProvider("jaiva", {
            provideDefinition(doc, pos) {
                return handler.identificationProvider.provideDefintion(
                    handler.shared,
                    doc,
                    pos,
                );
            },
        });
    }

    public docParse(doc: v.TextDocument) {
        if (doc.languageId !== "jaiva") return;

        if (doc.isUntitled) {
            return;
        }

        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }

        const t = this;
        this.debounceTimer = setTimeout(() => {
            void (async () => {
                const out = await t.cli.call([doc.uri.fsPath]);

                t.shared.write(doc, out);

                // const out2 = await t.cli.call([doc.uri.fsPath + "#INTERP"]);
                t.shared.err(doc, out);

                t.diagnostics.show(doc);
            })();
        }, 1000); // 1 second
    }
}

class Completions {
    constructor() {}

    public provide(
        shared: j.SharedValues,
        document: v.TextDocument,
        position: v.Position,
    ): v.CompletionItem[] {
        const completions: v.CompletionItem[] = [];

        const tokens = shared.read();

        tokens.forEach((token) => {
            if (
                token.type === "TFunction" || // dumbass if, the TFunction could be in the array but whatever.
                [
                    "TUnknownScalar",
                    "TBooleanVar",
                    "TStringVar",
                    "TArrayVar",
                    "TNumberVar",
                ].includes(token.type)
            ) {
                const lineNumber: number = position.line;

                if (token.within !== -1)
                    if (
                        !(
                            token.within[0] < lineNumber &&
                            token.within[1] > lineNumber
                        ) &&
                        !(
                            token.within[0] === token.within[1] &&
                            token.within[0] === token.lineNumber
                        )
                    )
                        return;
                if (token.lineNumber !== -1)
                    if (lineNumber < token.lineNumber) return;

                let completionItem: v.CompletionItem;
                if (token.type === "TFunction") {
                    const fn = token as j.Tokens.TFunction;
                    const funcName = token.name.slice(2);
                    let args: string[] = [];
                    for (let i = 0; i < fn.args.length; i++) {
                        const argument = fn.args[i];
                        if (fn.isArgOptional[i]) {
                            args.push("${" + (i + 1) + ":[" + argument + "?]}");
                        } else {
                            args.push("${" + (i + 1) + ":" + argument + "}");
                        }
                    }
                    const completionString =
                        funcName + "(" + args.join(", ") + ")$0";
                    completionItem = new v.CompletionItem(
                        funcName,
                        v.CompletionItemKind.Function,
                    );
                    completionItem.insertText = new v.SnippetString(
                        completionString,
                    );
                } else {
                    completionItem = new v.CompletionItem(
                        token.name,
                        v.CompletionItemKind.Variable,
                    );
                    if (
                        j.Tokens.hasPropertyOf<j.Tokens.FunctionArgument>(
                            token,
                            "argumentType",
                        )
                    ) {
                        completionItem.sortText = token.sortText + token.name;
                        if (token.argumentType === "F~") {
                            completionItem.insertText = new v.SnippetString(
                                token.name + "($0)",
                            );
                        }
                    }
                }
                completionItem.documentation = new v.MarkdownString(
                    j.Tokens.docsToMarkdown(token),
                );

                completions.push(completionItem);
            }
        });

        return completions;
    }
}

export class Diagnostics {
    private diagnostics: v.DiagnosticCollection;
    private list: MultiMap<v.TextDocument, v.Diagnostic> = new MultiMap();

    constructor(collection: v.DiagnosticCollection) {
        this.diagnostics = collection;
    }

    public clear(document: v.TextDocument): void {
        this.diagnostics.set(document.uri, []);
        this.list.setKey(document, []);
    }

    public show(document: v.TextDocument) {
        this.list.forEach((k, v) => {
            this.diagnostics.set(v.uri, k);
        });
    }

    public newErr(
        lineNumber: number,
        document: v.TextDocument,
        err: string,
    ): v.Diagnostic {
        const firstCharPos = new v.Position(lineNumber, 0);
        const lastCharPos = new v.Position(
            lineNumber,
            document.lineAt(lineNumber).range.end.character,
        );

        let d = new v.Diagnostic(
            new v.Range(firstCharPos, lastCharPos),
            err,
            v.DiagnosticSeverity.Error,
        );
        this.list.add(document, d);
        return d;
    }

    public err(document: v.TextDocument, err: j.StreamerOutput) {
        let lineNumber: number = 0;

        if (hasPropertyOf<j.InterpreterOutput>(err, "scope")) {
            err.warnings.forEach((warning) => {
                const line = warning.lineNumber - 1;
                const firstCharPos = new v.Position(line, 0);
                const lastCharPos = new v.Position(
                    line,
                    document.lineAt(line).range.end.character,
                );

                this.list.add(
                    document,
                    new v.Diagnostic(
                        new v.Range(firstCharPos, lastCharPos),
                        warning.message,
                        v.DiagnosticSeverity.Warning,
                    ),
                );
            });
        }

        if (err.type === "INTERP_SUCCESS") return;
        if (err.type !== "ERR_STREAMER") {
            if (err.lineNumber != -1) {
                lineNumber = err.lineNumber - 1;
            }
        }
        const firstCharPos = new v.Position(lineNumber, 0);
        const lastCharPos = new v.Position(
            lineNumber,
            document.lineAt(lineNumber).range.end.character,
        );
        this.list.add(
            document,
            new v.Diagnostic(
                new v.Range(firstCharPos, lastCharPos),
                err.message,
                v.DiagnosticSeverity.Error,
            ),
        );
    }
}

export class IdentificationProvider {
    private findToken(
        shared: j.SharedValues,
        document: v.TextDocument,
        pos: v.Position,
    ): TokenDefault | null {
        const range = document.getWordRangeAtPosition(pos);
        const word = document.getText(range);

        const line = pos.line;

        const found = shared
            .read()
            .map((a) => {
                if (a.type === "TFunction") {
                    const nae = a.name.slice(2);
                    const { name, ...others } = a;
                    return { name: nae, ...others };
                }
                return a;
            })
            .filter((a) => {
                return (
                    a.name === word &&
                    (a.within == -1 ||
                        (a.within[0] < line && a.within[1] > line)) // filter out scopes it cant be
                );
            })
            .sort((a, b) => {
                if (a.within == -1 && b.within != -1) return -1;
                if (a.within != -1 && b.within == -1) return 1;

                const withinA = a.within as [number, number];
                const withinB = b.within as [number, number];
                const sum1 = line - withinA[0] + (withinA[1] - line);
                const sum2 = line - withinB[0] + (withinB[1] - line);

                if (sum1 < sum2) return -1;
                else return 1;
            });

        if (found.length == 0) {
            // try looking in the map instead. lowkey last hope.
            const list = shared.definitionsMap.get(word);
            if (list.length == 0) return null;
            return { ...list[0] };
        }

        return found[0];
    }

    provideDocs(
        shared: j.SharedValues,
        document: v.TextDocument,
        pos: v.Position,
    ): v.ProviderResult<v.Hover> {
        const found = this.findToken(shared, document, pos);

        if (found == null) return;

        return new v.Hover(j.Tokens.docsToMarkdown(found));
    }

    provideDefintion(
        shared: j.SharedValues,
        document: v.TextDocument,
        pos: v.Position,
    ): v.ProviderResult<v.Definition> {
        const found = this.findToken(shared, document, pos);

        if (found == null) return;

        let lineNumber = found.lineNumber;
        if (j.Tokens.hasPropertyOf<ImportedFrom>(found, "importedFromLine")) {
            lineNumber = found.importedFromLine;
        }
        return new v.Location(document.uri, new v.Position(lineNumber - 1, 0));
    }
}
