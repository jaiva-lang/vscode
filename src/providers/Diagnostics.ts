import * as vs from "vscode";
import * as jaiva from "../jaiva";
import { hasPropertyOf } from "../jaiva";
import { MultiMap } from "../utils";

export interface RewriteDiagnostic extends vs.Diagnostic {
    rewrite: jaiva.RewriteSuggestion;
}

export class Diagnostics {
    private diagnostics: vs.DiagnosticCollection;
    private list: MultiMap<vs.TextDocument, vs.Diagnostic> = new MultiMap();

    constructor(collection: vs.DiagnosticCollection) {
        this.diagnostics = collection;
    }

    public clear(document: vs.TextDocument): void {
        this.diagnostics.set(document.uri, []);
        this.list.setKey(document, []);
    }

    public show(document: vs.TextDocument) {
        this.list.forEach((k, v) => {
            this.diagnostics.set(v.uri, k);
        });
    }

    public newErr(
        lineNumber: number,
        document: vs.TextDocument,
        err: string,
    ): vs.Diagnostic {
        const firstCharPos = new vs.Position(lineNumber, 0);
        const lastCharPos = new vs.Position(
            lineNumber,
            document.lineAt(lineNumber).range.end.character,
        );

        let d = new vs.Diagnostic(
            new vs.Range(firstCharPos, lastCharPos),
            err,
            vs.DiagnosticSeverity.Error,
        );
        this.list.add(document, d);
        return d;
    }

    public addRewriteDiagnostic(
        document: vs.TextDocument,
        rw: jaiva.RewriteSuggestion,
    ) {
        const range = rw.lineRange;
        const column = rw.columnRange
            ? rw.columnRange
            : [0, document.lineAt(range[1] - 1).range.end.character];

        const pos1 = new vs.Position(range[0] - 1, column[0]);
        const pos2 = new vs.Position(range[1] - 1, column[1]);

        const diagnostic = new vs.Diagnostic(
            new vs.Range(pos1, pos2),
            rw.message,
            vs.DiagnosticSeverity.Hint,
        ) as RewriteDiagnostic;

        diagnostic.code = rw.rewriteId;
        diagnostic.rewrite = rw;

        this.list.add(document, diagnostic);
    }

    public err(document: vs.TextDocument, err: jaiva.StreamerOutput) {
        let lineNumber: number = 0;

        if (hasPropertyOf<jaiva.InterpreterOutput>(err, "scope")) {
            err.warnings.forEach((warning) => {
                const line = warning.lineNumber - 1;
                const firstCharPos = new vs.Position(line, 0);
                const lastCharPos = new vs.Position(
                    line,
                    document.lineAt(line).range.end.character,
                );

                this.list.add(
                    document,
                    new vs.Diagnostic(
                        new vs.Range(firstCharPos, lastCharPos),
                        warning.message,
                        vs.DiagnosticSeverity.Warning,
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
        const firstCharPos = new vs.Position(lineNumber, 0);
        const lastCharPos = new vs.Position(
            lineNumber,
            document.lineAt(lineNumber).range.end.character,
        );
        const diag = new vs.Diagnostic(
            new vs.Range(firstCharPos, lastCharPos),
            err.message,
            vs.DiagnosticSeverity.Error,
        );
        if (err.message.includes("shout")) diag.code = "missing-excl";
        this.list.add(document, diag);
    }
}
