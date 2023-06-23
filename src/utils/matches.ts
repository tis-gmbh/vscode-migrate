export function matches<C>(actual: C, criteria: Criteria<C>): boolean {
    if (typeof criteria === "function") {
        return criteria(actual);
    }
    if (typeof actual !== typeof criteria) {
        return false;
    }
    if (typeof criteria === "object") {
        return matchesObject(actual, criteria);
    }
    return matchPrimitive(actual, criteria);
}

function matchesObject<C>(actual: C, criteria: Criteria<C>): boolean {
    if (Array.isArray(criteria)) {
        if (!Array.isArray(actual)) return false;
        return actual.length === criteria.length &&
            criteria.every((c: any, i: any) => matches(actual[i], c));
    }
    return Object.keys(criteria)
        .every(key =>
            matches(actual[key as keyof C], criteria[key as keyof Criteria<C>])
        );
}

function matchPrimitive(actual: any, criteria: any): boolean {
    return actual === criteria;
}

export type RecursivePartial<C> = {
    [P in keyof C]?: RecursivePartial<C[P]>;
};

export type FilterFunction<C> = (entry: C) => boolean;

export type Criteria<C> = RecursivePartial<C> | FilterFunction<C>;
