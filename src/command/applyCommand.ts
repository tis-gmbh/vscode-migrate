import { inject, injectable } from "inversify";
import { Progress, ProgressLocation, Uri } from "vscode";
import { TYPES, VSC_TYPES, VscWindow } from "../di/types";
import { MatchManager } from "../migration/matchManger";
import { MigrationHolderRemote } from "../migration/migrationHolderRemote";
import { NonEmptyArray } from "../utilTypes";
import { Lock } from "../utils/lock";

@injectable()
export abstract class ApplyCommand {
    public constructor(
        @inject(VSC_TYPES.VscWindow) protected readonly window: VscWindow,
        @inject(TYPES.MatchManager) protected readonly matchManager: MatchManager,
        @inject(TYPES.MigrationHolderRemote) protected readonly migrationHolder: MigrationHolderRemote,
        @inject(TYPES.ApplyExecutionLock) private readonly applyLock: Lock
    ) { }

    protected handleApplyError(error: any): void {
        const errorMessage = error.message || error;
        void this.window.showErrorMessage("Failed to apply. Reason: " + errorMessage);
    }

    protected handleVerifyError(error: any): void {
        const errorMessage = error.message || error;
        const message = `Failed to run verification tasks, the following error was thrown: ${errorMessage}`;
        throw new Error(message);
    }

    protected async tryApplyLocked(matches: NonEmptyArray<Uri>): Promise<void> {
        try {
            await this.applyLocked(matches);
        } catch (error) {
            this.handleApplyError(error);
        }
    }

    private applyLocked(matches: NonEmptyArray<Uri>): Promise<void> {
        return this.applyLock.lockWhile(() => this.apply(matches));
    }

    protected async apply(matches: NonEmptyArray<Uri>): Promise<void> {
        await this.save(matches);
        await this.close(matches);
        await this.applyWithProgress(matches);
        await this.checkMigrationDone();
    }

    protected abstract save(matches: NonEmptyArray<Uri>): Promise<void>;

    protected abstract close(_matches: NonEmptyArray<Uri>): Promise<void>;

    protected applyWithProgress(matches: NonEmptyArray<Uri>): Thenable<void> {
        return this.window.withProgress({
            title: this.getProgressTitle(matches),
            location: ProgressLocation.Notification
        }, progress => this.applyMatches(matches, progress));
    }

    protected abstract getProgressTitle(matches: NonEmptyArray<Uri>): string;

    protected abstract applyMatches(matches: NonEmptyArray<Uri>, progress: Progress<{ message?: string | undefined; increment?: number | undefined; }>): Promise<void>;

    protected async checkMigrationDone(): Promise<void> {
        if (this.matchManager.allResolved) {
            await this.migrationHolder.stop();
        }
    }

    protected async tryRunVerify(progress: Progress<{ message?: string | undefined; increment?: number | undefined; }>): Promise<void> {
        try {
            progress.report({ message: "Running verification tasks" });
            await this.runVerify();
        } catch (error) {
            this.handleVerifyError(error);
        }
    }

    private async runVerify(): Promise<void> {
        await this.migrationHolder.verify();
    }
}
