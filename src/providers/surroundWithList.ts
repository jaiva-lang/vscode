import * as vs from "vscode";
import { bracePairs, includes, includesWithAddedRegex } from "../utils";
import { Keywords } from "../jaiva";

export type Edited = {
    newSnippet: string;
    editedText: string;
};

type InvalidIf = (
    selected: string,
    lines: string[],
    selectedFullLine: string | undefined,
) => boolean;

type Editor = (line: string, oldSnippet: string) => Edited | undefined;

export type SurroundWith = {
    lbl: string;
    snippet: string;
    invalidIf?: InvalidIf[];
    postProcess?: Editor[];
};

function noBlockConstructs(...exclusions: string[]): InvalidIf[] {
    const rest =
        exclusions.length == 0
            ? Keywords.block
            : Keywords.block.filter((keyword) => !exclusions.includes(keyword));
    return [
        (i, lines) => lines.length != 1, // selected exists if this passes anyways.
        (_, _2, selected) =>
            includesWithAddedRegex(
                selected!,
                "\\s+${INCLUDE}\\s+",
                ...rest,
                "<~",
            ),
    ];
}

function moveEndOperator(line: string, oldSnippet: string): Edited | undefined {
    if (line.endsWith("!")) {
        return {
            newSnippet: oldSnippet + "!",
            editedText: line.slice(0, line.length - 1),
        };
    }
    return;
}

export const surroundWithList: SurroundWith[] = [
    {
        lbl: "Ternary (condition)",
        snippet: "(#v# => ${1:true} however ${2:false})$0",
        invalidIf: noBlockConstructs("colonize", "sif"),
        postProcess: [moveEndOperator],
    },
    {
        lbl: "Ternary (true-value)",
        snippet: "(${1:boolean} => #v# however ${2:false})$0",
        invalidIf: noBlockConstructs("colonize", "sif"),
        postProcess: [moveEndOperator],
    },
    {
        lbl: "Ternary (false-value)",
        snippet: "(${1:boolean} => ${2:true} however #v#)$0",
        invalidIf: noBlockConstructs("colonize", "sif"),
        postProcess: [moveEndOperator],
    },
    {
        lbl: "Sif",
        snippet: "sif (${1:condition}) ?> #v#$0",
        invalidIf: [
            ...noBlockConstructs(),
            (s, l, sfl) =>
                sfl?.replace(s, "").replace("!", "").trim().length != 0,
        ],
        postProcess: [moveEndOperator],
    },
    {
        lbl: "IIFE",
        snippet: "(f~(#params#) : ${1:use})(#v#)$0",
        invalidIf: noBlockConstructs("colonize", "sif"),
        postProcess: [
            (input, _) => {
                const pairs = bracePairs(input);
                let out: string = "param";
                if (
                    pairs.allClosed() &&
                    pairs.closedPairs.length > 0 &&
                    pairs.closedPairs.find(
                        (p) => p.first == 0 && p.second == input.length - 1,
                    )
                ) {
                    // remove surrounding pair.
                    input = input.slice(1, input.length - 1);
                    const spli = input.split(",");
                    if (spli.length > 0)
                        out =
                            spli.length > 5
                                ? "<-params"
                                : (out = spli
                                      .map((s, i) => "p" + (i + 1))
                                      .join(", "));
                } else if (
                    input.match(/^(?!0b|0x|0c)[a-zA-Z0-9-_\\.\s]+$/) &&
                    !input.match(/^[0-9]+|-[0-9]+$/) &&
                    !input.match(/idk/)
                ) {
                    out = input; // lol use as is.
                }

                return {
                    newSnippet: "(f~(" + out + ") : ${1:use})(#v#)$0",
                    editedText: input,
                };
            },
            moveEndOperator,
        ],
    },
];
