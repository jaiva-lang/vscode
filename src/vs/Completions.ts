import * as v from "vscode";
import * as j from "../jaiva/jaiva";

export class Completions {
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
