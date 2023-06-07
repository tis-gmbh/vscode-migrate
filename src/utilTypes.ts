export type NonEmptyArray<T> = [T, ...T[]];
export function isNotEmptyArray<T>(array: T[]): array is NonEmptyArray<T> {
    return array.length > 0;
}
