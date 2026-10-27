export type JDoc = {
    tagType: string;
};

type HasDescription = {
    description: string;
};

export type GenericDoc = {
    tagType: "GENERIC";
} & JDoc &
    HasDescription;

export type ParameterDoc = {
    tagType: "parameter";
    var: string;
    type: string;
    optional: boolean;
} & JDoc &
    HasDescription;

export type ReturnDoc = {
    tagType: "return";
} & JDoc &
    HasDescription;

export type FromDoc = {
    tagType: "from";
    version: string;
} & JDoc;

export type DevNoteDoc = {
    tagType: "devnote";
} & JDoc &
    HasDescription;

export type DeprecatedDoc = {
    tagType: "deprecated";
} & JDoc &
    HasDescription;

export type ExampleDoc = {
    tagType: "example";
    codeblock: string[];
} & JDoc;

export type DependsOnDoc = {
    tagType: "depends";
    symbols: string[];
};

import { hasPropertyOf } from "./types";

export function toMarkdown(doc: JDoc | null): string {
    if (doc == null) return "";
    if (hasPropertyOf<ParameterDoc>(doc, "var")) {
        return (
            " - **" +
            doc.var +
            (!doc.optional ? "?" : "") +
            "** <- _" +
            doc.type +
            "_ : " +
            doc.description
        );
    } else if (doc.tagType === "deprecated") {
        const dep = doc as DeprecatedDoc;
        return "### " + dep.description + "\n\n";
    } else if (hasPropertyOf<ExampleDoc>(doc, "codeblock")) {
        return "```jaiva\n" + doc.codeblock.join("\n") + "\n```\n\n";
    } else if (hasPropertyOf<DependsOnDoc>(doc, "symbols")) {
        return (
            "> This function depends on: " + doc.symbols.join(", ") + ".\n\n"
        );
    } else if (doc.tagType === "devnote") {
        const devn = doc as DevNoteDoc;
        return "> **_Developer Note_** : _" + devn.description + "_\n\n";
    } else if (doc.tagType === "returns") {
        const ret = doc as ReturnDoc;
        return "**`Returns`** - " + ret.description + "\n\n";
    } else if (hasPropertyOf<FromDoc>(doc, "version")) {
        return "**`" + doc.version + "`**\n\n";
    } else if (doc.tagType === "GENERIC") {
        return (doc as GenericDoc).description + "\n\n";
    }
    return "Jaiva Construct";
    // if (hasPropertyOf<GenericDoc>(doc, ""))
}
