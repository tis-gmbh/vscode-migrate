import { EventEmitter } from "vscode";

function matches(actual: any, criteria: any): boolean {
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

type RecursivePartial<C> = {
    [P in keyof C]?: RecursivePartial<C[P]>;
};

export class AwaitEntryArray<C extends Record<string, any>> extends Array<C> {
    public static instances = [] as AwaitEntryArray<any>[];
    private readonly recordsChangedEmitter = new EventEmitter<C>();
    public readonly awaitedCriteria = [] as RecursivePartial<C>[];

    public constructor(...records: C[]) {
        super(...records);
        AwaitEntryArray.instances.push(this);
    }

    public override push(...records: C[]): number {
        for (const record of records) {
            this.recordsChangedEmitter.fire(record);
        }
        return super.push(...records);
    }

    public awaitEntryMatching(criteria: RecursivePartial<C>): Promise<C> {
        return Promise.resolve(
            this.findEntryMatching(criteria)
            || this.waitForEntryMatching(criteria)
        );
    }

    private findEntryMatching(criteria: RecursivePartial<C>): C | undefined {
        return this.find(entry => matches(entry, criteria));
    }

    private waitForEntryMatching(criteria: RecursivePartial<C>): Promise<C> {
        this.awaitedCriteria.push(criteria);
        return new Promise(res => {
            const subscription = this.recordsChangedEmitter.event((update: C) => {
                if (matches(update, criteria)) {
                    this.awaitedCriteria.splice(
                        this.awaitedCriteria.indexOf(criteria), 1
                    );
                    subscription.dispose();
                    res(update);
                }
            });
        });
    }
}
