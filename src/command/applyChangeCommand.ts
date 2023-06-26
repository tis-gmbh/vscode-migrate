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

    protected async apply(matches: NonEmptyArray<Uri>): Promise<void> {
        const matchUri = matches[0];
        await this.saveEditor(matchUri);
        await this.closeCurrent(matchUri);
        await this.applyChangesWithProgress(matchUri);
        await this.checkMigrationDone();
    }

    private async closeCurrent(matchUri: Uri): Promise<void> {
        const active = this.window.activeTextEditor;
        if (active && stringify(active.document.uri) === stringify(matchUri)) {
            await this.commands.executeCommand("workbench.action.closeActiveEditor");
        }
    }

    private applyChangesWithProgress(matchUri: Uri): Thenable<void> {
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

        try {
            progress.report({ message: "Running verification tasks" });
            await this.migrationHolder.verify();
        } catch (error) {
            this.handleVerifyError(error);
        }

        progress.report({ message: "Committing file" });
        await this.versionControl.stageAndCommit(matchUri);
    }

    private async saveEditor(matchUri: Uri): Promise<void> {
        const stringifiedUri = stringify(matchUri);
        const modifiedDocument = this.workspace.textDocuments.find(
            candidate => stringify(candidate.uri) === stringifiedUri
        );

        if (modifiedDocument && modifiedDocument.isDirty) {
            await modifiedDocument.save();
        }
    }
}
