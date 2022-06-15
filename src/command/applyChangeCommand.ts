import { inject, injectable } from "inversify";
import { FileSystemProvider, ProgressLocation, Uri } from "vscode";
import { TYPES, VscCommands, VscWindow, VscWorkspace, VSC_TYPES } from "../di/types";
import { MatchManager } from "../migration/matchManger";
import { MigrationHolder } from "../migration/migrationHolder";
import { toFileUri } from "../utils/uri";
import { VersionControl } from "../vcs/versionControl";
import { Command } from "./command";
import { NextChangeCommand } from "./nextChangeCommand";

@injectable()
export class ApplyChangeCommand extends NextChangeCommand implements Command {
    public readonly id = "vscode-migrate.apply-change";

    public constructor(
        @inject(TYPES.ChangedContentProvider) protected readonly changedContentProvider: FileSystemProvider,
        @inject(VSC_TYPES.VscWindow) protected readonly window: VscWindow,
        @inject(VSC_TYPES.VscWorkspace) protected readonly workspace: VscWorkspace,
        @inject(TYPES.MatchManager) protected readonly matchManager: MatchManager,
        @inject(VSC_TYPES.VscCommands) protected readonly commands: VscCommands,
        @inject(TYPES.VersionControl) protected readonly versionControl: VersionControl,
        @inject(TYPES.MigrationHolder) protected readonly migrationHolder: MigrationHolder
    ) {
        super(
            changedContentProvider,
            window,
            workspace,
            matchManager,
            commands
        );
    }

    public async execute(matchUri: Uri): Promise<void> {
        await super.execute(matchUri);
        try {
            await this.applyChangesFor(matchUri);
        } catch (error: any) {
            this.handleApplyError(error);
        }
    }

    private async applyChangesFor(matchUri: Uri): Promise<void> {
        const fileUri = toFileUri(matchUri);

        await this.window.withProgress({
            title: "Applying Change",
            location: ProgressLocation.Notification
        }, async (progress) => {
            progress.report({ message: "Saving File" });
            const newContent = await this.changedContentProvider.readFile(matchUri);
            await this.workspace.fs.writeFile(fileUri, newContent);
            this.matchManager.resolveEntry(matchUri);

            progress.report({ message: "Running verification tasks" });
            await this.migrationHolder.verify();

            progress.report({ message: "Committing file" });
            await this.versionControl.stageAndCommit(matchUri);
        });
    }

    private handleApplyError(error: any): void {
        const errorMessage = error.message || error;
        const message = `Failed to run verification tasks, the following error was thrown: ${errorMessage}`;
        void this.window.showErrorMessage(message);
    }
}
