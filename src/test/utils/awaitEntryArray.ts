import { EventEmitter } from "vscode";
import { Criteria, matches } from "../../utils/matches";

export class AwaitEntryArray<C extends Record<string, any>> extends Array<C> {
    public static instances = [] as AwaitEntryArray<any>[];
    private readonly recordsChangedEmitter = new EventEmitter<C>();
    public readonly awaitedCriteria: Array<Criteria<C>> = [];

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

    public awaitEntryMatching(criteria: Criteria<C>): Promise<C> {
        return Promise.resolve(
            this.findEntryMatching(criteria)
            || this.waitForEntryMatching(criteria)
        );
    }

    private findEntryMatching(criteria: Criteria<C>): C | undefined {
        return this.find(entry => matches(entry, criteria));
    }

    private waitForEntryMatching(criteria: Criteria<C>): Promise<C> {
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
