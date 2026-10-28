import * as vs from "vscode";
import * as jaiva from "../jaiva";

export class IdentificationProvider {
    private findToken(
        shared: jaiva.SharedValues,
        document: vs.TextDocument,
        pos: vs.Position,
    ): jaiva.Tokens.TokenDefault | null {
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
        shared: jaiva.SharedValues,
        document: vs.TextDocument,
        pos: vs.Position,
    ): vs.ProviderResult<vs.Hover> {
        const found = this.findToken(shared, document, pos);

        if (found == null) return;

        return new vs.Hover(jaiva.Tokens.docsToMarkdown(found));
    }

    provideDefintion(
        shared: jaiva.SharedValues,
        document: vs.TextDocument,
        pos: vs.Position,
    ): vs.ProviderResult<vs.Definition> {
        const found = this.findToken(shared, document, pos);

        if (found == null) return;

        let lineNumber = found.lineNumber;
        if (
            jaiva.Tokens.hasPropertyOf<jaiva.Tokens.ImportedFrom>(
                found,
                "importedFromLine",
            )
        ) {
            lineNumber = found.importedFromLine;
        }
        return new vs.Location(
            document.uri,
            new vs.Position(lineNumber - 1, 0),
        );
    }
}
