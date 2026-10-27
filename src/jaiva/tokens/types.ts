import {
    JDoc,
    toMarkdown,
    ParameterDoc,
    GenericDoc,
    DeprecatedDoc,
} from "./jdoc";
import { JSONObject } from "../../JSONObject";

/**
 * The types that we care about the most
 */
export type TokenType =
    | "TFuncCall"
    | "TVarRef"
    | "TFunction"
    | "TUnknownScalar";

/**
 * The tokens that we actually want to store for reference later. Others like other body stuff
 * are indexed into but never stored.
 */
const needed = [
    "TFuncCall",
    "TVarRef",
    "TFunction",
    "TUnknownScalar",
    "TBooleanVar",
    "TArrayVar",
    "TStringVar",
    "TNumberVar",
    "TImport",
];

/**
 * The scope that this particular symbol is available within. -1 means it's availble globally.
 * This is usually a direct copy of the parent scope's lineNumebr and lineEnd into one argument
 * that goes with the token itself
 */
export type LineRange = NonGlobalLineRange | -1;

export type NonGlobalLineRange = [number, number];

/**
 * Base token. All tokens have these properties
 */
export type TokenDefault = {
    type: string | TokenType;
    name: string;
    lineNumber: number;
    toolTip: string | JDoc[];
    within: LineRange;
};

export type TTryCatchStatement = {
    type: "TTryCatch";
    try: JSONObject; // TCodeblock
    catch: JSONObject; // TCodeblock
    catchProperties: NonGlobalLineRange; // So subsequent code can add the "error" variables
} & TokenDefault;

export type TIfStatement = {
    type: "TIfStatement";
    body: JSONObject; // TCodeblock
    elseIfs: TIfStatement[] | null; // Nested TIfStatements. No subsequent have nests
    elseBody: JSONObject | null; // TCodeblock
} & TokenDefault;

/**
 * Import token. Used so we can either import jaiva internals or other files (one day. rn dont give 2 shits)
 */
export type ImportToken = {
    filePath: string;
    fileName: string;
    isLib: boolean;
    symbols: string[];
} & TokenDefault;

/**
 * A scoped token, like an if statement or a function, has a lineEnd
 * Typically, in the actual JSON output (and the Java), a scoped token
 * has a "body" property with a TCodeBlock token, which has the "lineEnd"
 * property. but for compactness we extract it
 */
export type ScopedToken = {
    lineEnd: number;
} & TokenDefault;

/**
 * A symbol token, being a function or variable.
 */
export type SymbolToken = {
    exportSymbol: boolean;
} & TokenDefault;

/**
 * A function.
 */
export type TFunction = {
    args: string[];
    isArgOptional: boolean[];
    varArgs: boolean;
} & SymbolToken &
    ScopedToken;

/**
 * A variable reference
 */
export type TVarRef = {
    type: "TVarRef";
    varName: string;
    getLength: boolean;
    spreadArr: boolean;
} & TokenDefault;

/**
 * A fucntion call
 */
export type TFuncCall = {
    type: "TFuncCall";
    functionName: string;
    getLength: boolean;
    spreadArr: boolean;
} & TokenDefault;

/**
 * A for loop. This is one of the constructs we nee dto lookout for particularly because
 * it makes a new "variable"
 */
export type TForLoop = {
    type: "TForLoop";
    arrayVariable: TokenDefault | null;
    variable: TokenDefault | null;
} & ScopedToken;

/**
 * Special Tokens are those which the extension creates for hover and other stuff.
 * So that are stuff like function parameters or the variables made by colonize loops
 */
export type SpecialToken = {
    sortText: "0_" | "1_" | "2_";
} & TokenDefault;

/**
 * A function argument token created by the extension
 */
export type FunctionArgument = {
    argumentType: "V~" | "F~" | "<-";
} & SpecialToken;

/**
 * Denotes that this symbol was imported from either the standrd librayr or anotehr file
 * This is purely so we can point the user to where they imported it
 */
export type ImportedFrom = {
    importedFromLine: number;
};

/**
 * Convenience function over {@link hasPropertyOf} to specifically check for
 * a JDoc object
 * @param value The unknown value
 * @returns a boolean indicating this is a JDoc object
 */
export function isDoc(value: unknown): value is JDoc {
    return hasPropertyOf<JDoc>(value, "tagType");
}

/**
 * Generic function which, if a given unknown object has a speciifc property, we tell the compiler
 * that we are smarter than it and we are sure that its definitely for sure this type.
 * @param value The unknwon type
 * @param property The property to check for existenc
 * @returns da bool
 */
export function hasPropertyOf<T>(value: unknown, property: string): value is T {
    return typeof value === "object" && value !== null && property in value;
}

/**
 * Checks if the given token is a token we need by checking whther its
 * token type is within the {@link needed} array
 * @param token The token to check against
 * @returns bool
 */
export function isTheTokensWeNeed(token: TokenDefault): boolean {
    return needed.includes(token.type);
}

/**
 * Converts a {@link TokenDefault.toolTip} property to a markdown string for documentation purposes.
 * @param token The token with the tooltip property
 * @returns A markdown string.
 */
export function docsToMarkdown(token: TokenDefault): string {
    const out: string[] = [];

    if (
        hasPropertyOf<SymbolToken>(token, "toolTip") ||
        hasPropertyOf<SpecialToken>(token, "sortText")
    ) {
        let str;
        if (hasPropertyOf<TFunction>(token, "args")) {
            const args: string[] = [];
            token.args.forEach((c, i) => {
                args.push(c + (!token.isArgOptional[i] ? "" : "?"));
            });
            str = token.name + "(" + args.join(", ") + ")";
        } else if (
            [
                "TBooleanVar",
                "TStringVar",
                "TUnknownScalar",
                "TNumberVar",
                "TArrayVar",
            ].includes(token.type) &&
            !hasPropertyOf<SpecialToken>(token, "sortText")
        ) {
            str =
                "maak " +
                token.name +
                " <-" +
                (token.type === "TArrayVar" ? "| " : " ") +
                "...";
        } else if (hasPropertyOf<SpecialToken>(token, "sortText")) {
            if (hasPropertyOf<FunctionArgument>(token, "argumentType")) {
                str =
                    "(parameter) " +
                    (token.argumentType != "<-" ? token.argumentType : "") +
                    token.name +
                    (token.argumentType === "F~"
                        ? "(...)"
                        : " <-" +
                          (token.argumentType === "<-" ? "|" : "") +
                          " ...");
            } else {
                str =
                    (typeof token.toolTip === "string" &&
                    token.toolTip.startsWith("Chaai")
                        ? "(caught error) "
                        : "(array var) ") + token.name;
            }
        }

        if (typeof token.toolTip === "string")
            return ("```jaiva\n" + str + "\n```\n" + token.toolTip) as string;

        const doc = token.toolTip as JDoc[];
        const param: ParameterDoc[] = [];
        let deprecated: DeprecatedDoc | null = null;
        let generic: GenericDoc | null = null;
        const docs: JDoc[] = [];
        out.push("```jaiva\n" + str + "\n```\n");
        for (const d of doc) {
            if (d.tagType === "parameter") {
                param.push(d as ParameterDoc);
            } else if (d.tagType === "GENERIC") {
                generic = d as GenericDoc;
            } else if (d.tagType === "deprecated") {
                deprecated = d as DeprecatedDoc;
            } else {
                docs.push(d);
            }
        }

        if (deprecated != null) out.push(toMarkdown(deprecated));
        out.push(toMarkdown(generic));
        param.forEach((c) => out.push(toMarkdown(c)));
        out.push("\n");
        docs.forEach((c) => out.push(toMarkdown(c)));
    }

    return out.join("\n");
}

/**
 *
 */
function extractScopedToken(
    value: unknown,
    isCodeblock = false,
): [LineRange, JSONObject[]] | null {
    let body: unknown;
    if (!isCodeblock) {
        if (typeof value !== "object" || value === null || !("body" in value)) {
            return null;
        }

        body = value.body;
    }

    body = value;

    if (typeof body !== "object" || body === null || !("lines" in body)) {
        return null;
    }

    // at this poinr it definitely has the rest.

    type Body = {
        lines: JSONObject[];
        lineNumber: number;
        lineEnd: number;
    };

    const b = body as Body;

    // if it has body it absolutely has lines
    // if it doesnt. life.

    return [[b.lineNumber, b.lineEnd], b.lines];
}

/**
 * Convert a given object into a scoped token.
 * Due to the actual output having a more complicated structure and the typescript
 * not matching it, this function exists.
 * @param value The value to convert (if it is a scoped token)
 * @returns A tuple containing the scoped token and every other token that was in this scoped token.
 */
export function toScopedToken(
    value: unknown,
): [ScopedToken, [LineRange, JSONObject[]][]] | null {
    if (typeof value !== "object" || value === null || !("body" in value)) {
        if (hasPropertyOf<TTryCatchStatement>(value, "catch")) {
            // special handling since try catch decided to be special
            const lines: [LineRange, JSONObject[]][] = [];
            const catchBlock = value.catch;
            const tryBlock = value.try;
            const catchBlockProps = extractScopedToken(catchBlock, true)!;
            const tryBlockProps = extractScopedToken(tryBlock, true)!;
            const tryBlockEnd = tryBlockProps[0] as [number, number];

            lines.push(catchBlockProps);
            lines.push(tryBlockProps);
            return [
                {
                    ...({
                        ...value,
                        catchProperties: catchBlockProps[0],
                    } as TTryCatchStatement),
                    lineEnd: tryBlockEnd[1],
                } as ScopedToken,
                lines,
            ];
        }
        return null;
    }

    const { body, ...simplified } = value;

    if (typeof body !== "object" || body === null || !("lines" in body)) {
        return null;
    }

    // at this poinr it definitely has the rest.

    type Body = {
        lines: JSONObject[];
        lineEnd: number;
    };

    const b = body as Body;

    // if it has body it absolutely has lines
    // if it doesnt. life.

    const token = {
        ...simplified,
        lineEnd: b.lineEnd,
    } as ScopedToken;

    const lines: [LineRange, JSONObject[]][] = [];

    lines.push([[token.lineNumber, token.lineEnd], b.lines]);

    if (hasPropertyOf<TIfStatement>(value, "elseBody")) {
        const elseBlock = extractScopedToken(value.elseBody, true);
        const chainedIfs = value.elseIfs;

        if (chainedIfs) {
            chainedIfs.forEach((i) => {
                const ifBlock = extractScopedToken(i.body, true);
                lines.push(ifBlock!);
            });
        }

        if (elseBlock) {
            lines.push(elseBlock);
        }
    }

    return [token, lines];
}
