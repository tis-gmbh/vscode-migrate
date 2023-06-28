import { inject, injectable } from "inversify";
import { Progress, ProgressLocation, TabGroup, TabInputText, TabInputTextDiff, Uri } from "vscode";
import { TYPES, VSC_TYPES, VscWindow, VscWorkspace } from "../di/types";
import { MatchManager } from "../migration/matchManger";
import { MigrationHolderRemote } from "../migration/migrationHolderRemote";
import { MatchFileSystemProvider } from "../providers/matchFileSystemProvider";
import { MatchCollection } from "../test/utils/matchCollection";
import { NonEmptyArray } from "../utilTypes";
import { Lock } from "../utils/lock";
import { stringify, toFileUri } from "../utils/uri";

export type WindowProgress = Progress<{
    message?: string | undefined;
    increment?: number | undefined;
}>;

@injectable()
export abstract class ApplyCommand {
    public constructor(
        @inject(VSC_TYPES.VscWindow) protected readonly window: VscWindow,
        @inject(TYPES.MatchManager) protected readonly matchManager: MatchManager,
        @inject(TYPES.MigrationHolderRemote) protected readonly migrationHolder: MigrationHolderRemote,
        @inject(TYPES.ApplyExecutionLock) private readonly applyLock: Lock,
        @inject(VSC_TYPES.VscWorkspace) protected readonly workspace: VscWorkspace,
        @inject(TYPES.MatchFileSystemProvider) protected readonly changedContentProvider: MatchFileSystemProvider,
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

    protected async tryApplyLocked(matches: MatchCollection): Promise<void> {
        try {
            await this.applyLocked(matches);
        } catch (error) {
            this.handleApplyError(error);
        }
    }

    private applyLocked(matches: MatchCollection): Promise<void> {
        return this.applyLock.lockWhile(() => this.apply(matches));
    }

    protected async apply(matches: MatchCollection): Promise<void> {
        await this.save();
        await this.close(matches);
        await this.applyWithProgress(matches);
        await this.checkMigrationDone();
    }

    protected async save(): Promise<void> {
        await this.workspace.saveAll(false);
    }

    protected async close(matches: MatchCollection): Promise<void> {
        const allMatches = Object.values(matches).flat();
        const matchUrisAsString = allMatches.map(stringify);
        const tabGroups: readonly TabGroup[] = this.window.tabGroups?.all || [];

        for (const tabGroup of tabGroups) {
            for (const tab of tabGroup.tabs) {
                let uri: Uri;

                if (tab.input instanceof TabInputTextDiff) {
                    uri = tab.input.modified;
                } else if (tab.input instanceof TabInputText) {
                    uri = tab.input.uri;
                } else {
                    continue;
                }

                if (matchUrisAsString.includes(stringify(uri))) {
                    await this.window.tabGroups?.close(tab);
                }
            }
        }
    }

    protected applyWithProgress(matches: MatchCollection): Thenable<void> {
        return this.window.withProgress({
            title: this.getProgressTitle(matches),
            location: ProgressLocation.Notification
        }, progress => this.applyMatches(matches, progress));
    }

    protected abstract getProgressTitle(matches: MatchCollection): string;

    protected async applyMatches(matches: MatchCollection, progress: WindowProgress): Promise<void> {
        await this.writeChanges(matches, progress);
        await this.tryRunVerify(progress);
        await this.commitToVcs(matches, progress);
        this.resolveMatches(matches);
    }

    private resolveMatches(matches: MatchCollection): void {
        const allMatches = Object.values(matches).flat();
        this.matchManager.resolveEntries(allMatches);
    }

    protected abstract writeChanges(matches: MatchCollection, progress: WindowProgress): Promise<void>;


    protected abstract commitToVcs(matches: MatchCollection, progress: WindowProgress): Promise<void>;


    protected async checkMigrationDone(): Promise<void> {
        if (this.matchManager.allResolved) {
            await this.migrationHolder.stop();
        }
    }

    protected async tryRunVerify(progress: WindowProgress): Promise<void> {
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

    protected async writeSameFileChanges(matches: Uri[]): Promise<void> {
        if (!matches[0]) return;
        const fileUri = toFileUri(matches[0]);
        const newContent = await this.changedContentProvider
            .getMergeResult(...matches as NonEmptyArray<Uri>);

        const newBuffer = Buffer.from(newContent);
        await this.workspace.fs.writeFile(fileUri, newBuffer);
    }
}
