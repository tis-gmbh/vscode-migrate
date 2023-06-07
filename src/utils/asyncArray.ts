export async function asyncFilter<T>(array: T[], predicate: (item: T) => Promise<boolean>): Promise<T[]> {
    const results = await Promise.all(array.map(predicate));
    return array.filter((_v, index) => results[index]);
}

export async function asyncSome<T>(array: T[], predicate: (item: T) => Promise<boolean>): Promise<boolean> {
    for (const item of array) {
        if (await predicate(item)) {
            return true;
        }
    }
    return false;
}
