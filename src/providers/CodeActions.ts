import * as vs from "vscode";

import { RewriteDiagnostic } from "./";

export class CodeActions {
    public provideCodeActions(
        document: vs.TextDocument,
        range: vs.Range | vs.Selection,
        context: vs.CodeActionContext,
        token: vs.CancellationToken,
    ): vs.ProviderResult<(vs.Command | vs.CodeAction)[]> {
        const actions: vs.CodeAction[] = [];

        for (const diagnostic of context.diagnostics) {
            if (
                diagnostic.severity !== vs.DiagnosticSeverity.Hint ||
                typeof diagnostic.code !== "string"
            )
                continue;

            const rewriteDiagnostic = diagnostic as RewriteDiagnostic;

            if (!rewriteDiagnostic.rewrite) continue;

            let action: vs.CodeAction | undefined;

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
        document: vs.TextDocument,
        diagnostic: RewriteDiagnostic,
    ): vs.CodeAction {
        const action = new vs.CodeAction(
            "Convert to sif",
            vs.CodeActionKind.QuickFix,
        );

        const edit = new vs.WorkspaceEdit();

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
        document: vs.TextDocument,
        diagnostic: RewriteDiagnostic,
    ): vs.CodeAction {
        const action = new vs.CodeAction(
            "Use argument extension syntax",
            vs.CodeActionKind.QuickFix,
        );

        // TODO: Set action.edit using diagnostic.rewrite.
        return action;
    }
}
