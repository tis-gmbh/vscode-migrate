import { inject, injectable } from "inversify";
import { Uri } from "vscode";
import { TYPES, VSC_TYPES, VscCommands, VscWindow, VscWorkspace } from "../di/types";
import { MatchManager } from "../migration/matchManger";
import { MigrationHolderRemote } from "../migration/migrationHolderRemote";
import { MatchFileSystemProvider } from "../providers/matchFileSystemProvider";
import { MatchCollection } from "../test/utils/matchCollection";
import { Lock } from "../utils/lock";
import { VersionControl } from "../vcs/versionControl";
import { ApplyCommand, WindowProgress } from "./applyCommand";
import { Command } from "./command";

@injectable()
export class ApplyChangeCommand extends ApplyCommand implements Command {
    public readonly id = "vscode-migrate.apply-change";

    public constructor(
        @inject(TYPES.MatchFileSystemProvider) protected readonly changedContentProvider: MatchFileSystemProvider,
        @inject(VSC_TYPES.VscWindow) protected readonly window: VscWindow,
        @inject(VSC_TYPES.VscWorkspace) protected readonly workspace: VscWorkspace,
        @inject(TYPES.MatchManager) protected readonly matchManager: MatchManager,
        @inject(VSC_TYPES.VscCommands) protected readonly commands: VscCommands,
        @inject(TYPES.VersionControl) protected readonly versionControl: VersionControl,
        @inject(TYPES.MigrationHolderRemote) protected readonly migrationHolder: MigrationHolderRemote,
        @inject(TYPES.ApplyExecutionLock) applyLock: Lock
    ) {
        super(window, matchManager, migrationHolder, applyLock, workspace, changedContentProvider);
    }

    public async execute(matchUri: Uri): Promise<void> {
        const collection = new MatchCollection();
        collection.push(matchUri);
        await this.tryApplyLocked(collection);
    }

    protected getProgressTitle(matches: MatchCollection): string {
        const matchUri = matches[0]!;
        const match = this.matchManager.byMatchUriOrThrow(matchUri);
        return `Applying Change ${match.match.label}`;
    }

    protected async commitToVcs(matches: MatchCollection, progress: WindowProgress): Promise<void> {
        const matchUri = matches[0]!;
        progress.report({ message: "Committing file" });
        await this.versionControl.stageAndCommit(matchUri);
    }

    protected async writeChanges(matches: MatchCollection, progress: WindowProgress): Promise<void> {
        progress.report({ message: "Applying changes" });
        await this.writeSameFileChanges(Object.values(matches).flat());
    }
}
