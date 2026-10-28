import * as v from "vscode";
import * as j from "../jaiva/jaiva";
import { hasPropertyOf } from "../jaiva/tokens/types";
import { MultiMap } from "../mmap";

export interface RewriteDiagnostic extends v.Diagnostic {
    rewrite: j.Rewrite;
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

    public addRewriteDiagnostic(document: v.TextDocument, rw: j.Rewrite) {
        const range = rw.lineRange;

        const pos1 = new v.Position(range[0] - 1, 0);

        const pos2 = new v.Position(
            range[1] - 1,
            document.lineAt(range[1] - 1).range.end.character,
        );

        const diagnostic = new v.Diagnostic(
            new v.Range(pos1, pos2),
            rw.message,
            v.DiagnosticSeverity.Hint,
        ) as RewriteDiagnostic;

        diagnostic.code = rw.rewriteId;
        diagnostic.rewrite = rw;

        this.list.add(document, diagnostic);
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
