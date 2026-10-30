export * as Tokens from "./tokens/types";
export * as Globals from "./globals";
export * as Docs from "./tokens/jdoc";
export * from "./jaiva";

/**
 * The scope that this particular symbol is available within. -1 means it's availble globally.
 * This is usually a direct copy of the parent scope's lineNumebr and lineEnd into one argument
 * that goes with the token itself
 */
export type ScopeRange = NonGlobalScopeRange | -1;

/**
 * Differentiate from LineRange for the purpose of not conflating the two.
 * As this isnt a generic line to line range but a scope line to line range.
 */
export type NonGlobalScopeRange = [number, number];
export type LineRange = [number, number];

export namespace Keywords {
    export const block = [
        "if",
        "mara",
        "zama zama",
        "chaai",
        "sif",
        "colonize",
        "kwenza",
        "nikhil",
    ];
    export const all = [
        ...block,
        "however",
        "tsea",
        "tšea",
        "maak",
        "cima",
        "khutla",
        "with",
        "idk",
        "voetsek",
        "nevermind",
    ];
}

export {
    hasPropertyOf,
    toScopedToken,
    isTheTokensWeNeed,
    docsToMarkdown,
    isDoc,
} from "./tokens/types";
