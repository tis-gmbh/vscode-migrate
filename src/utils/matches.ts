export function matches(actual: any, criteria: any): boolean {
    if (typeof actual !== typeof criteria) {
        return false;
    }
    if (typeof criteria === "object") {
        return matchesObject(actual, criteria);
    }
    return matchPrimitive(actual, criteria);
}

function matchesObject(actual: any, criteria: any): boolean {
    if (Array.isArray(criteria)) {
        return actual.length === criteria.length &&
            criteria.every((c: any, i: any) => matches(actual[i], c));
    }
    return Object.keys(criteria).every(key => matches(actual[key], criteria[key]));
}

function matchPrimitive(actual: any, criteria: any): boolean {
    return actual === criteria;
}
