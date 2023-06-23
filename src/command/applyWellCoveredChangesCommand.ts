import { inject, injectable } from "inversify";
import { Progress, ProgressLocation, Uri } from "vscode";
import { ApplyQueue } from "../applyQueue";
import { TYPES, VSC_TYPES, VscCommands, VscWindow, VscWorkspace } from "../di/types";
import { MergeService } from "../mergeService";
import { MatchManager } from "../migration/matchManger";
import { MigrationHolderRemote } from "../migration/migrationHolderRemote";
import { CoverageProvider } from "../providers/coverageProvider";
import { MatchCoverageFilter } from "../providers/matchCoverageFilter";
import { MatchFileSystemProvider } from "../providers/matchFileSystemProvider";
import { NonEmptyArray } from "../utilTypes";
import { parse, stringify, toFileUri } from "../utils/uri";
import { VersionControl } from "../vcs/versionControl";
import { ApplyCommand } from "./applyCommand";
import { Command } from "./command";

@injectable()
export class ApplyWellCoveredChangesCommand extends ApplyCommand implements Command {
    public readonly id = "vscode-migrate.apply-well-covered-matches";

    public constructor(
        @inject(TYPES.MatchFileSystemProvider) protected readonly changedContentProvider: MatchFileSystemProvider,
        @inject(VSC_TYPES.VscWindow) protected readonly window: VscWindow,
        @inject(VSC_TYPES.VscWorkspace) protected readonly workspace: VscWorkspace,
        @inject(TYPES.MatchManager) protected readonly matchManager: MatchManager,
        @inject(VSC_TYPES.VscCommands) protected readonly commands: VscCommands,
        @inject(TYPES.VersionControl) protected readonly versionControl: VersionControl,
        @inject(TYPES.MigrationHolderRemote) protected readonly migrationHolder: MigrationHolderRemote,
        @inject(TYPES.CoverageProvider) protected readonly coverageProvider: CoverageProvider,
        @inject(TYPES.MergeService) protected readonly mergeService: MergeService,
        @inject(TYPES.MatchCoverageFilter) protected readonly matchCoverageFilter: MatchCoverageFilter,
        @inject(TYPES.ApplyQueue) private readonly queue: ApplyQueue,
    ) {
        super();
    }

    public async execute(): Promise<void> {
        const filesWithCoveredMatches = await this.matchCoverageFilter.getQueuedFiles();
        const matchUrisGroupedByFile = await Promise.all(filesWithCoveredMatches.map((file) => this.matchCoverageFilter.getMatchUrisByFileUri(file)));
        const matches = matchUrisGroupedByFile.flat();

        matches.forEach((match) => this.queue.push(stringify(match)));
        try {
            await this.applyChangesWithProgress(matches);
            await this.checkMigrationDone();
        } finally {
            matches.forEach((match) => this.queue.remove(stringify(match)));
            if (this.queue.isEmpty()) {
                this.queue.lastExecution = undefined;
            }
        }
    }

    private applyChangesWithProgress(matches: Uri[]): Thenable<void> {
        const applyChanges = async (progress: Progress<{ message: string }>): Promise<void> => {
            const previousExecution = this.queue.lastExecution;
            if (previousExecution) {
                progress.report({ message: "Waiting for previous execution" });
                await this.waitForPreviousExecution(previousExecution);
            }
            try {
                progress.report({ message: "Running verification tasks" });
                await this.migrationHolder.verify();
                await this.applyMatches(matches);
            } catch (error) {
                this.handleApplyError(error);
                this.queue.lastExecution = undefined;
                throw error;
            }
        };

        return this.window.withProgress({
            title: `Applying Well Covered Changes`,
            location: ProgressLocation.Notification
        }, progress => this.queue.lastExecution = applyChanges(progress));
    }

    private async waitForPreviousExecution(previousExecution: Thenable<void>): Promise<void> {
        try {
            await previousExecution;
        } catch (error) {
            void this.window.showErrorMessage(`Changes were not applied because the previous application failed.`);
            throw error;
        }
    }

    private async applyMatches(matches: Uri[]): Promise<void> {
        await this.workspace.saveAll();

        const files = new Set(matches.map((match) => stringify(toFileUri(match))));
        for (const file of files) {
            await this.applyMatchesInFile(parse(file));
        }

        await this.versionControl.stageAll();
        await this.versionControl.commit(`Batch application of ${matches.length} well covered matches for migration 'Brackets'`);
        this.matchManager.resolveEntries(matches);
    }

    private async applyMatchesInFile(fileUri: Uri): Promise<Uri[]> {
        const matches = await this.matchCoverageFilter.getMatchUrisByFileUri(fileUri) as NonEmptyArray<Uri>;
        const newContent = await this.changedContentProvider.getMergeResult(...matches);

        const newBuffer = Buffer.from(newContent);
        await this.workspace.fs.writeFile(fileUri, newBuffer);
        return matches;
    }

    private handleApplyError(error: any): void {
        const errorMessage = error.message || error;
        const message = `Failed to run verification tasks, the following error was thrown: ${errorMessage}`;
        void this.window.showErrorMessage(message);
    }

    private async checkMigrationDone(): Promise<void> {
        if (this.matchManager.allResolved) {
            await this.migrationHolder.stop();
        }
    }
}
