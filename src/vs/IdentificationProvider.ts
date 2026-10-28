import * as v from "vscode";
import * as j from "../jaiva/jaiva";
import { TokenDefault, ImportedFrom } from "../jaiva/tokens/types";

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
