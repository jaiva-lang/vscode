export * as Tokens from "./tokens/types";
export * as Globals from "./globals";
export * as Docs from "./tokens/jdoc";
export * from "./jaiva";

/**
 * The scope that this particular symbol is available within. -1 means it's availble globally.
 * This is usually a direct copy of the parent scope's lineNumebr and lineEnd into one argument
 * that goes with the token itself
 */
export type LineRange = NonGlobalLineRange | -1;
export type NonGlobalLineRange = [number, number];

export {
    hasPropertyOf,
    toScopedToken,
    isTheTokensWeNeed,
    docsToMarkdown,
    isDoc,
} from "./tokens/types";
