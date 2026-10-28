import * as vs from "vscode";
import * as jaiva from "../jaiva";

export class Completions {
    constructor() {}

    public provide(
        shared: jaiva.SharedValues,
        document: vs.TextDocument,
        position: vs.Position,
    ): vs.CompletionItem[] {
        const completions: vs.CompletionItem[] = [];

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

        return completions;
    }
}
