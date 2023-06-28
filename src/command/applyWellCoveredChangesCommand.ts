import { inject, injectable } from "inversify";
import { TYPES, VSC_TYPES, VscCommands, VscWindow, VscWorkspace } from "../di/types";
import { MergeService } from "../mergeService";
import { MatchManager } from "../migration/matchManger";
import { MigrationHolderRemote } from "../migration/migrationHolderRemote";
import { CoverageProvider } from "../providers/coverageProvider";
import { MatchCoverageFilter } from "../providers/matchCoverageFilter";
import { MatchFileSystemProvider } from "../providers/matchFileSystemProvider";
import { MatchCollection } from "../test/utils/matchCollection";
import { Lock } from "../utils/lock";
import { VersionControl } from "../vcs/versionControl";
import { ApplyCommand, WindowProgress } from "./applyCommand";
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
        @inject(TYPES.ApplyExecutionLock) applyLock: Lock,
    ) {
        super(window, matchManager, migrationHolder, applyLock, workspace, changedContentProvider);
    }

    public async execute(): Promise<void> {
        const matches = await this.getWellCoveredMatches();
        await this.tryApplyLocked(matches);
    }

    private async getWellCoveredMatches(): Promise<MatchCollection> {
        const filesWithCoveredMatches = await this.matchCoverageFilter.getQueuedFiles();
        const matches = new MatchCollection();

        for (const file of filesWithCoveredMatches) {
            const matchUris = await this.matchCoverageFilter
                .getMatchUrisByFileUri(file);
            matches.push(...matchUris);
        }

        return matches;
    }

    protected getProgressTitle(matches: MatchCollection): string {
        return `Applying ${matches.length} Well Covered Changes`;
    }

    protected async commitToVcs(matches: MatchCollection): Promise<void> {
        await this.versionControl.stageAll();
        await this.versionControl.commit(`Batch application of ${Object.values(matches).flat().length} well covered matches for migration 'Brackets'`);
    }

    protected async writeChanges(matches: MatchCollection, _progress: WindowProgress): Promise<void> {
        for (const file of matches.files()) {
            await this.writeSameFileChanges(matches.ofFile(file));
        }
    }
}
