import { injectable } from "inversify";

@injectable()
export class ApplyQueue {
    private readonly queue: string[] = [];
    public lastExecution?: Thenable<void>;
    private _isLocked = false;

    public push(value: string): void {
        this.queue.push(value);
    }

    public remove(value: string): void {
        const index = this.queue.indexOf(value);
        if (index >= 0) {
            this.queue.splice(index, 1);
        }
    }

    public includes(value: string): boolean {
        return this.queue.includes(value);
    }

    public isEmpty(): boolean {
        return this.queue.length === 0;
    }

    public isPreviousExecutionRunning(): boolean {
        return !!this.lastExecution;
    }

    public async lockWhile(blocking: () => Promise<void>): Promise<void> {
        this.throwIfLocked();

        try {
            this.lock();
            return await blocking();
        } finally {
            return this.unblock();
        }
    }

    private throwIfLocked(): void {
        if (this.isLocked()) {
            throw new Error(`Previous execution is still running.`);
        }
    }

    private lock(): void {
        this._isLocked = true;
    }

    private unblock(): void {
        this._isLocked = false;
    }

    public isLocked(): boolean {
        return this._isLocked;
    }
}
