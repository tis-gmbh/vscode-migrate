import { injectable } from "inversify";

@injectable()
export class ApplyQueue {
    private _isLocked = false;

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
