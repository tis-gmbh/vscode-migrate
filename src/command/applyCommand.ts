import { inject, injectable } from "inversify";
import { Uri } from "vscode";
import { TYPES, VSC_TYPES, VscWindow } from "../di/types";
import { MatchManager } from "../migration/matchManger";
import { MigrationHolderRemote } from "../migration/migrationHolderRemote";
import { NonEmptyArray } from "../utilTypes";

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

    protected async checkMigrationDone(): Promise<void> {
        if (this.matchManager.allResolved) {
            await this.migrationHolder.stop();
        }
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

    protected abstract apply(matches: NonEmptyArray<Uri>): Promise<void>;
}
