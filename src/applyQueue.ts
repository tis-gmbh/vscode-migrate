import { injectable } from "inversify";

@injectable()
export class ApplyQueue {
    private readonly queue: string[] = [];
    public lastExecution?: Thenable<void>;

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
}
