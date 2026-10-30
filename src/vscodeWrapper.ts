import * as v from "vscode";
import * as j from "./jaiva/jaiva";
import * as providers from "./providers";

export class AllHandler {
    public shared: j.SharedValues;
    public cli: j.JaivaCLI;
    public completions: providers.Completions = new providers.Completions();
    private version: string; // unused.
    public diagnostics: providers.Diagnostics;
    private identificationProvider: providers.IdentificationProvider =
        new providers.IdentificationProvider();
    private codeActions: providers.CodeActions = new providers.CodeActions();

    private debounceTimer?: NodeJS.Timeout;

    constructor(
        version: string,
        shared: j.SharedValues,
        cli: j.JaivaCLI,
        diagnostic: providers.Diagnostics,
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
        vscode.languages.registerCodeActionsProvider(
            "jaiva",
            this.codeActions as v.CodeActionProvider,
        );
    }

    public docParse(doc: v.TextDocument) {
        if (doc.languageId !== "jaiva") return;

        if (doc.isUntitled) return;

        if (this.debounceTimer) clearTimeout(this.debounceTimer);

        const t = this;
        this.debounceTimer = setTimeout(() => {
            void (async () => {
                const out = await t.cli.call([doc.uri.fsPath]);

                t.shared.write(doc, out);

                console.log(t.shared.rewriteArr);

                t.shared.rewriteArr.forEach((re) => {
                    t.diagnostics.addRewriteDiagnostic(doc, re);
                });

                // const out2 = await t.cli.call([doc.uri.fsPath + "#INTERP"]);
                t.shared.err(doc, out);

                t.diagnostics.show(doc);
            })();
        }, 1000); // 1 second
    }
}
