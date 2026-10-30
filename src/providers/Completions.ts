import * as vs from "vscode";
import * as jaiva from "../jaiva";
import { SymbolToken } from "../jaiva/tokens/types";
import { Keywords } from "../jaiva";
export class Completions {
    constructor() {}

    public provide(
        shared: jaiva.SharedValues,
        document: vs.TextDocument,
        position: vs.Position,
    ): vs.CompletionItem[] {
        const completions: vs.CompletionItem[] = [];

        const tokens = shared.read();

        const txt = document.getText(
            new vs.Range(new vs.Position(position.line, 0), position),
        );

        if (["tsea", "tšea"].includes(txt.trim())) {
            importCompletions(shared, completions);
        } else symbolCompletions(tokens, position, completions);

        Keywords.all.forEach((word) =>
            completions.push(
                new vs.CompletionItem(word, vs.CompletionItemKind.Keyword),
            ),
        );

        return completions;
    }
}
function symbolCompletions(
    tokens: jaiva.Tokens.TokenDefault[],
    position: vs.Position,
    completions: vs.CompletionItem[],
) {
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

            let completionItem: vs.CompletionItem;
            if (token.type === "TFunction") {
                const fn = token as jaiva.Tokens.TFunction;
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
                completionItem = new vs.CompletionItem(
                    funcName,
                    vs.CompletionItemKind.Function,
                );
                completionItem.insertText = new vs.SnippetString(
                    completionString,
                );
            } else {
                completionItem = new vs.CompletionItem(
                    token.name,
                    vs.CompletionItemKind.Variable,
                );
                if (
                    jaiva.Tokens.hasPropertyOf<jaiva.Tokens.FunctionArgument>(
                        token,
                        "argumentType",
                    )
                ) {
                    completionItem.sortText = token.sortText + token.name;
                    if (token.argumentType === "F~") {
                        completionItem.insertText = new vs.SnippetString(
                            token.name + "($0)",
                        );
                    }
                }
            }

            completionItem.documentation = new vs.MarkdownString(
                jaiva.Tokens.docsToMarkdown(token),
            );

            completions.push(completionItem);
        }
    });
}

function importCompletions(
    shared: jaiva.SharedValues,
    completions: vs.CompletionItem[],
) {
    const imports = shared.getLibraryMapKeys().filter((r) => r !== "globals");
    imports.forEach((path) => {
        const completionItem = new vs.CompletionItem(
            path,
            vs.CompletionItemKind.Enum,
        );
        const lib = shared.getLibrary(path);
        completionItem.documentation = new vs.MarkdownString(
            `Contains **${lib?.tokens.length}** symbols\n` +
                `Symbols:\n` +
                `\`${lib?.tokens
                    .filter((e) =>
                        jaiva.hasPropertyOf<SymbolToken>(e, "exportSymbol"),
                    )
                    .map((e) => e.name)
                    .join("`\n`")}\``,
        );
        completionItem.insertText = new vs.SnippetString(
            `\"jaiva/${path}\"!\n$0`,
        );
        completions.push(completionItem);
    });
}
