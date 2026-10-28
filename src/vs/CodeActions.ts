import * as v from "vscode";

import { RewriteDiagnostic } from "./Diagnostics";

export class CodeActions {
    public provideCodeActions(
        document: v.TextDocument,
        range: v.Range | v.Selection,
        context: v.CodeActionContext,
        token: v.CancellationToken,
    ): v.ProviderResult<(v.Command | v.CodeAction)[]> {
        const actions: v.CodeAction[] = [];

        for (const diagnostic of context.diagnostics) {
            if (
                diagnostic.severity !== v.DiagnosticSeverity.Hint ||
                typeof diagnostic.code !== "string"
            )
                continue;

            const rewriteDiagnostic = diagnostic as RewriteDiagnostic;

            if (!rewriteDiagnostic.rewrite) continue;

            let action: v.CodeAction | undefined;

            switch (diagnostic.code) {
                case "sif":
                    action = this.sif(document, rewriteDiagnostic);
                    break;

                case "argExt":
                    action = this.argExt(document, rewriteDiagnostic);
                    break;
            }

            if (action) {
                action.diagnostics = [diagnostic];
                actions.push(action);
            }
        }

        return actions;
    }

    private sif(
        document: v.TextDocument,
        diagnostic: RewriteDiagnostic,
    ): v.CodeAction {
        const action = new v.CodeAction(
            "Convert to sif",
            v.CodeActionKind.QuickFix,
        );

        const edit = new v.WorkspaceEdit();

        const source = document.getText(diagnostic.range);

        const lns = source.split("\n");

        const comments: string[] = [];

        const argExt: string[] = [];

        let statement = "";

        const head = lns.shift();
        const headIndent = head?.match(/^\s*/)?.[0] ?? "";
        const headAndC = head
            ?.trim()
            .replace("->", "")
            .split(/(?<!\$)@/);

        if (headAndC && headAndC.length != 1) comments.push("@" + headAndC[1]);

        const end = lns.pop()?.trim().replace("<~", "");

        const endAndC = end?.split(/(?<!\$)@/);

        lns.forEach((line) => {
            const trimmedLine = line.trim();

            if (trimmedLine.startsWith("@")) {
                comments.push(trimmedLine);
            } else if (trimmedLine.startsWith("|>")) {
                argExt.push(line);
            } else {
                const lineAndC = trimmedLine.split(/(?<!\$)@/);

                if (lineAndC.length != 1) comments.push("@" + lineAndC[1]);

                statement = lineAndC[0];
            }
        });

        if (endAndC && endAndC.length != 1) comments.push("@" + endAndC[1]);

        const replacement =
            headIndent +
            "s" +
            (headAndC ? headAndC : [""])[0].trim() +
            " ?> " +
            statement +
            "\n" +
            argExt.join("\n") +
            "\n" +
            comments.map((s) => headIndent + s).join("\n");

        edit.replace(document.uri, diagnostic.range, replacement);

        action.edit = edit;

        return action;
    }

    private argExt(
        document: v.TextDocument,
        diagnostic: RewriteDiagnostic,
    ): v.CodeAction {
        const action = new v.CodeAction(
            "Use argument extension syntax",
            v.CodeActionKind.QuickFix,
        );

        // TODO: Set action.edit using diagnostic.rewrite.
        return action;
    }
}
