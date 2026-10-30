// stolen from my Find.java in Jaiva lol.

import { array } from "node:stream/iter";

export class Pair<A, B> {
    constructor(
        public readonly first: A,
        public readonly second: B,
    ) {}
}

export class SamePair<T> extends Pair<T, T> {}

export interface BracePairs {
    allClosed: () => boolean;
    isEmpty: () => boolean;
    closedPairs: SamePair<number>[];
    unclosedBraces: Pair<number, string>[];
    danglingClose: Pair<number, string>[];
}

/**
 * Finds matching quotation mark indices.
 */
export function quotationPairs(line: string): SamePair<number>[] {
    const arr: SamePair<number>[] = [];
    let oldCharIndex = -1;

    for (let i = 0; i < line.length; i++) {
        const c = line[i];
        const before = i > 0 ? line[i - 1] : "";
        const before2 = i > 1 ? line[i - 2] : "";

        if (c === '"' && (before !== "$" || before2 === "$")) {
            if (oldCharIndex === -1) oldCharIndex = i;
            else {
                arr.push(new Pair(oldCharIndex, i));
                oldCharIndex = -1;
            }
        }
    }

    return arr;
}

/**
 * Returns whether an index is inside a matched quotation pair.
 */
function isInQuotePair(index: number, quotePairs: SamePair<number>[]): boolean {
    return quotePairs.some(
        (quote) => index > quote.first && index < quote.second,
    );
}

/**
 * Finds matching parentheses and square brackets.
 */
export function bracePairs(line: string): BracePairs {
    const closedPairs: SamePair<number>[] = [];
    const stack: Pair<number, string>[] = [];
    const danglingClose: Pair<number, string>[] = [];
    const quotes = quotationPairs(line);

    for (let i = 0; i < line.length; i++) {
        const c = line[i];

        if (isInQuotePair(i, quotes)) continue;

        if (c === "[" || c === "(") stack.push(new Pair(i, c));

        if (c === "]" || c === ")") {
            if (stack.length === 0) {
                danglingClose.push(new Pair(i, c));
                continue;
            }

            const t = stack[stack.length - 1];

            if (
                (t.second === "[" && c === "]") ||
                (t.second === "(" && c === ")")
            ) {
                closedPairs.push(new SamePair(t.first, i));
                stack.pop();
            }
        }
    }

    return {
        closedPairs,
        unclosedBraces: stack,
        danglingClose,
        allClosed: () => stack.length == 0 && danglingClose.length == 0,
        isEmpty: () =>
            closedPairs.length == 0 &&
            stack.length == 0 &&
            danglingClose.length == 0,
    };
}

/**
 * Returns the index of the opening brace in the last closed pair,
 * or -1 if no closed pairs exist.
 */
export function lastOuterMostBracePairIndex(line: string): number {
    return lastOutermostBracePair(line)?.first ?? -1;
}

/**
 * Returns the last closed brace pair, or null if none exist.
 */
export function lastOutermostBracePair(line: string): SamePair<number> | null {
    const closed = bracePairs(line).closedPairs;
    return closed.length === 0 ? null : closed[closed.length - 1];
}

export function lastIndexOf(statement: string, input: string): number {
    let index = -1;
    let containsIndex = true;

    while (containsIndex) {
        const i = statement.indexOf(input);

        if (i === -1) {
            containsIndex = false;
            continue;
        }

        if (
            !isInQuotePair(i, quotationPairs(statement)) &&
            !isInPair(i, bracePairs(statement).closedPairs)
        )
            index = i;

        statement = statement.replace(input, "-".repeat(input.length));
    }

    return index;
}

export function isInPair(index: number, pairs: SamePair<number>[]): boolean {
    return pairs.some((pair) => index > pair.first && index < pair.second);
}

export function removeLastPairs(str: string): string {
    const str2 = bracePairs(str);
    if (str2.isEmpty()) return str;
    if (str2 && str2.closedPairs[str2.closedPairs.length - 1].first == 0)
        return str.substring(1, str.length - 1);
    return str;
}

export function split(input: string, separator: string): string[] {
    const bracePairz = bracePairs(input);
    const quotePairs = quotationPairs(input);

    let acc = "";
    const content: string[] = [];
    let dangling = false;
    for (let i = 0; i < input.length; i++) {
        const inBrace = bracePairz.closedPairs.some(
            (pair) => i >= pair.first && i <= pair.second,
        );
        const inQuote = quotePairs.some(
            (pair) => i >= pair.first && i <= pair.second,
        );

        // does the separator start here, and are we allowed to split here?
        const atSeparator =
            input.startsWith(separator, i) && !dangling && !inBrace && !inQuote;

        if (!atSeparator) {
            const ch = input[i];
            if ((ch === '"' || ch === "(") && !(inBrace || inQuote))
                dangling = true;
            acc += ch;
            continue;
        }

        // we're splitting here — flush and skip past the separator
        if (acc.length > 0) {
            content.push(acc);
            acc = "";
        }
        i += separator.length - 1; // loop's i++ handles the rest
    }

    if (acc.length > 0) {
        content.push(acc);
    }

    return content;
}

export function includes(stri: string, ...arr: string[]): boolean {
    return arr.some((element) => stri.includes(element));
}

export function includesWithAddedRegex(
    stri: string,
    reg: string,
    ...arr: string[]
): boolean {
    return arr.some(
        (element) =>
            stri.includes(element) &&
            stri.match(new RegExp(reg.replace("${INCLUDE}", element))) != null,
    );
}
