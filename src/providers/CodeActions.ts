import * as vs from "vscode";

import { RewriteDiagnostic } from "./";
import { bracePairs, includes, removeLastPairs, split } from "../utils";
import { surroundWithList } from "./surroundWithList";

export class CodeActions {
    public provideCodeActions(
        document: vs.TextDocument,
        range: vs.Range | vs.Selection,
        context: vs.CodeActionContext,
        token: vs.CancellationToken,
    ): vs.ProviderResult<(vs.Command | vs.CodeAction)[]> {
        const actions: vs.CodeAction[] = [];

        const s = document.getText(range);

        if (!range.isEmpty) {
            const action: vs.CodeAction[] = this.surroundWithActions(
                s,
                document,
                range,
                context,
            );
            actions.push(...action);
        }
        if (includes(document.getText(range), "||", "&&")) {
            const action = this.deMorgansLaw(document, range);
            if (action) actions.push(action);
        }
        for (const diagnostic of context.diagnostics) {
            let action: vs.CodeAction | undefined;

            if (diagnostic.severity === vs.DiagnosticSeverity.Error) {
                switch (diagnostic.code) {
                    case "missing-excl":
                        action = this.missingExcl(document, diagnostic);
                        break;
                }
            } else if (
                diagnostic.severity !== vs.DiagnosticSeverity.Hint ||
                typeof diagnostic.code !== "string"
            ) {
                const rewriteDiagnostic = diagnostic as RewriteDiagnostic;

                if (!rewriteDiagnostic.rewrite) continue;

                switch (diagnostic.code) {
                    case "sif":
                        action = this.sif(document, rewriteDiagnostic);
                        break;

                    case "argExt":
                        action = this.argExt(document, rewriteDiagnostic);
                        break;
                }
            }

            if (action) {
                action.diagnostics = [diagnostic];
                actions.push(action);
            }
        }

        return actions;
    }

    deMorgansLaw(
        document: vs.TextDocument,
        range: vs.Range | vs.Selection,
    ): vs.CodeAction | undefined {
        let str = document.getText(range);

        const action = new vs.CodeAction(
            "De Morgan's Law",
            vs.CodeActionKind.Refactor,
        );

        const edit = new vs.WorkspaceEdit();

        // if it has both.. nah bro too risky.
        // if (str.includes("||") && str.includes("&&")) return undefined;

        let braces = bracePairs(str);

        if (!braces.allClosed()) return undefined;

        const m1 = str.match(/\(.*\|\|.*\)/);
        const attemptM2 = true;
        if (m1) {
            action.title += " Factorise";
            const index = m1.index!;

            const endsInNeg = str.endsWith("'");
            if (endsInNeg) {
                str = str.substring(0, str.length - 1);
                braces = bracePairs(str); // gotta do again.
            }

            const pair = braces.closedPairs.find(
                (pair) => pair.first === index,
            );

            const enclosedInBrace =
                braces.closedPairs.length > 0 &&
                braces.closedPairs.find(
                    (s) => s.first == 0 && s.second == str.length - 1,
                ) != undefined;
            if (pair) {
                let before = !enclosedInBrace ? "" : str.slice(0, pair.first);
                let after = !enclosedInBrace
                    ? ""
                    : str.slice(pair.second + 1, str.length);

                let matched = !enclosedInBrace
                    ? str
                    : removeLastPairs(
                          str.slice(pair.first, pair.second + 1).trim(),
                      ).trim();

                let spli = split(matched, "||");

                if (spli.length != 1) {
                    const b = spli.some((s) => hasExlcudedAtTopLvel(s, "&&"));

                    if (!b) {
                        // TODO: might be unsafe. but im too lazy to check im prayign the rgex did all the work for me.
                        edit.replace(
                            document.uri,
                            range,
                            before +
                                "(" +
                                spli
                                    .map((s) => s.trim())
                                    .map((s) =>
                                        s.endsWith("'")
                                            ? s.substring(0, s.length - 1)
                                            : s + "'",
                                    )
                                    .join(" && ") +
                                ")" +
                                (after.trim().startsWith("'") || endsInNeg
                                    ? ""
                                    : "'"),
                        );

                        action.edit = edit;

                        return action;
                    }
                }
            }
        }

        const m2 = str.match(/\(.*&&.*\)/);
        if (attemptM2 && m2) {
            action.title += " Distribute";
            const index = m2.index!;

            const pair = braces.closedPairs.find(
                (pair) => pair.first === index,
            );
            if (pair) {
                let before = str.slice(0, pair.first);
                let after = str.slice(pair.second + 1, str.length);

                let matched = removeLastPairs(
                    str.slice(pair.first, pair.second + 1).trim(),
                ).trim();

                // remove the not at the start of after

                const hasNot = after.endsWith("'");

                after = hasNot ? after.substring(1, after.length) : after;

                let spli = split(matched, "&&");

                if (spli.length != 1) {
                    const b = spli.some((s) => hasExlcudedAtTopLvel(s, "||"));
                    if (!b) {
                        edit.replace(
                            document.uri,
                            range,
                            before +
                                "(" +
                                spli
                                    .map((s) => s.trim())
                                    .map((s) =>
                                        s.endsWith("'")
                                            ? s.substring(0, s.length - 1)
                                            : s + "'",
                                    )
                                    .join(" || ") +
                                ")" +
                                after +
                                (!hasNot ? "'" : ""),
                        );

                        action.edit = edit;

                        return action;
                    }
                }
            }
        }

        return undefined;
    }

    missingExcl(
        document: vs.TextDocument,
        diagnostic: vs.Diagnostic,
    ): vs.CodeAction {
        const action = new vs.CodeAction(
            "Add missing exclamation mark.",
            vs.CodeActionKind.QuickFix,
        );
        const edit = new vs.WorkspaceEdit();
        const source = document.getText(diagnostic.range);
        edit.replace(document.uri, diagnostic.range, source + "!");
        action.edit = edit;
        return action;
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

        // soon.

        return action;
    }

    surroundWithActions(
        selectedText: string,
        doc: vs.TextDocument,
        range: vs.Range,
        context: vs.CodeActionContext,
    ): vs.CodeAction[] {
        const actions: vs.CodeAction[] = [];
        const lines = selectedText.split("\n");
        let selectedFullLine: string;
        if (range.isSingleLine) {
            selectedFullLine = doc.getText(
                new vs.Range(
                    new vs.Position(range.start.line, 0),
                    new vs.Position(
                        range.start.line,
                        doc.lineAt(range.start.line).range.end.character,
                    ),
                ),
            );
        }
        for (const s of surroundWithList) {
            const action = new vs.CodeAction(
                "Surround with " + s.lbl,
                vs.CodeActionKind.RefactorRewrite,
            );

            if (
                s.invalidIf &&
                s.invalidIf.some((pred) =>
                    pred(selectedText, lines, selectedFullLine),
                )
            )
                continue;

            let sl;
            let newS: string = selectedText;
            let snippet: string = s.snippet;

            if (s.postProcess) {
                for (const mod of s.postProcess) {
                    sl = mod(newS, snippet);
                    if (!sl) continue;
                    newS = sl.editedText;
                    snippet = sl.newSnippet;
                }
            }

            const snippetString = new vs.SnippetString(
                snippet.replace("#v#", newS),
            );

            action.command = {
                command: "editor.action.insertSnippet",
                title: "Surround with " + s.lbl,
                arguments: [{ snippet: snippetString.value, range: range }],
            };

            actions.push(action);
        }
        return actions;
    }
}

function hasExlcudedAtTopLvel(str: string, excl: "||" | "&&"): boolean {
    const s = split(str, excl);
    return s.length !== 1;
}
