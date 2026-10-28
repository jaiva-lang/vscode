// stolen from my Find.java in Jaiva lol.

export class Pair<A, B> {
    constructor(
        public readonly first: A,
        public readonly second: B,
    ) {}
}

export class SamePair<T> extends Pair<T, T> {}

export interface BracePairs {
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

/**
 * Finds the last index of the given input string in statement, while
 * disregarding input enclosed in quotation marks or inside a set of brackets
 * [] or parentheses ().
 *
 * This is meant for properly splitting nested ternary expressions at the
 * correct places. It can be used elsewhere provided with caution.
 *
 * @param statement The statement to check within.
 * @param input The input to check for.
 * @returns The index of the first character of the last valid occurrence,
 *          or -1 if no valid index is found.
 */
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
