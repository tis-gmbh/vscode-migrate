import { inject, injectable } from "inversify";
import { FileSystemProvider, Progress, ProgressLocation, Uri } from "vscode";
import { TYPES, VSC_TYPES, VscCommands, VscWindow, VscWorkspace } from "../di/types";
import { MatchManager } from "../migration/matchManger";
import { MigrationHolderRemote } from "../migration/migrationHolderRemote";
import { NonEmptyArray } from "../utilTypes";
import { Lock } from "../utils/lock";
import { stringify, toFileUri } from "../utils/uri";
import { VersionControl } from "../vcs/versionControl";
import { ApplyCommand } from "./applyCommand";
import { Command } from "./command";

@injectable()
export class ApplyChangeCommand extends ApplyCommand implements Command {
    public readonly id = "vscode-migrate.apply-change";

    public constructor(
        @inject(TYPES.MatchFileSystemProvider) protected readonly changedContentProvider: FileSystemProvider,
        @inject(VSC_TYPES.VscWindow) protected readonly window: VscWindow,
        @inject(VSC_TYPES.VscWorkspace) protected readonly workspace: VscWorkspace,
        @inject(TYPES.MatchManager) protected readonly matchManager: MatchManager,
        @inject(VSC_TYPES.VscCommands) protected readonly commands: VscCommands,
        @inject(TYPES.VersionControl) protected readonly versionControl: VersionControl,
        @inject(TYPES.MigrationHolderRemote) protected readonly migrationHolder: MigrationHolderRemote,
        @inject(TYPES.ApplyExecutionLock) applyLock: Lock
    ) {
        super(window, matchManager, migrationHolder, applyLock);
    }

    public async execute(matchUri: Uri): Promise<void> {
        await this.tryApplyLocked([matchUri]);
    }

    protected async close(matches: NonEmptyArray<Uri>): Promise<void> {
        const matchUri = matches[0];
        const active = this.window.activeTextEditor;
        if (active && stringify(active.document.uri) === stringify(matchUri)) {
            await this.commands.executeCommand("workbench.action.closeActiveEditor");
        }
    }

    protected applyChangesWithProgress(matches: NonEmptyArray<Uri>): Thenable<void> {
        const matchUri = matches[0];
        const match = this.matchManager.byMatchUriOrThrow(matchUri);

        return this.window.withProgress({
            title: `Applying Change ${match.match.label}`,
            location: ProgressLocation.Notification
        }, progress => this.applyChangesForMatch(matchUri, progress));
    }

    private async applyChangesForMatch(matchUri: Uri, progress: Progress<{ message?: string | undefined; increment?: number | undefined; }>): Promise<void> {
        const fileUri = toFileUri(matchUri);
        progress.report({ message: "Saving File" });
        const newContent = await this.changedContentProvider.readFile(matchUri);
        await this.workspace.fs.writeFile(fileUri, newContent);

        this.matchManager.resolveEntry(matchUri);

        await this.tryRunVerify(progress);

        progress.report({ message: "Committing file" });
        await this.versionControl.stageAndCommit(matchUri);
    }

    protected async save(matches: NonEmptyArray<Uri>): Promise<void> {
        const matchUri = matches[0];
        const stringifiedUri = stringify(matchUri);
        const modifiedDocument = this.workspace.textDocuments.find(
            candidate => stringify(candidate.uri) === stringifiedUri
        );

        if (modifiedDocument && modifiedDocument.isDirty) {
            await modifiedDocument.save();
        }
    }
}
