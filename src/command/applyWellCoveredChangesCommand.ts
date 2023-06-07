import { inject, injectable } from "inversify";
import { ProgressLocation, Uri } from "vscode";
import { TYPES, VSC_TYPES, VscCommands, VscWindow, VscWorkspace } from "../di/types";
import { MergeService } from "../mergeService";
import { MatchManager } from "../migration/matchManger";
import { MigrationHolderRemote } from "../migration/migrationHolderRemote";
import { CoverageProvider } from "../providers/coverageProvider";
import { MatchCoverageFilter } from "../providers/matchCoverageFilter";
import { MatchFileSystemProvider } from "../providers/matchFileSystemProvider";
import { NonEmptyArray } from "../utilTypes";
import { VersionControl } from "../vcs/versionControl";
import { Command } from "./command";

@injectable()
export class ApplyWellCoveredChangesCommand implements Command {
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
        @inject(TYPES.MatchCoverageFilter) protected readonly matchCoverageFilter: MatchCoverageFilter
    ) {
    }

    public async execute(): Promise<void> {
        await this.applyChangesWithProgress();
        await this.checkMigrationDone();
    }

    private applyChangesWithProgress(): Thenable<void> {
        const applyChanges = async (): Promise<void> => {
            try {
                await this.applyMatches();
            } catch (error) {
                this.handleApplyError(error);
                throw error;
            }
        };

        return this.window.withProgress({
            title: `Applying Well Covered Changes`,
            location: ProgressLocation.Notification
        }, () => applyChanges());
    }

    private async applyMatches(): Promise<void> {
        const filesWithCoveredMatches = await this.matchCoverageFilter.getQueuedFiles();
        let matches: Uri[] = [];
        for (const file of filesWithCoveredMatches) {
            matches = matches.concat(await this.applyMatchesInFile(file));
        }

        await this.workspace.saveAll();
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
