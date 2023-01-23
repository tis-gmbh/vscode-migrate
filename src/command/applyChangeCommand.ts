import { inject, injectable } from "inversify";
import { FileSystemProvider, Progress, ProgressLocation, Uri } from "vscode";
import { TYPES, VscCommands, VscWindow, VscWorkspace, VSC_TYPES } from "../di/types";
import { MatchManager } from "../migration/matchManger";
import { MigrationHolderRemote } from "../migration/migrationHolderRemote";
import { stringify, toFileUri } from "../utils/uri";
import { VersionControl } from "../vcs/versionControl";
import { Command } from "./command";
import { NextChangeCommand } from "./nextChangeCommand";

@injectable()
export class ApplyChangeCommand extends NextChangeCommand implements Command {
    public readonly id = "vscode-migrate.apply-change";
    private lastExecution?: Thenable<void>;
    private readonly queue: string[] = [];

    public constructor(
        @inject(TYPES.ChangedContentProvider) protected readonly changedContentProvider: FileSystemProvider,
        @inject(VSC_TYPES.VscWindow) protected readonly window: VscWindow,
        @inject(VSC_TYPES.VscWorkspace) protected readonly workspace: VscWorkspace,
        @inject(TYPES.MatchManager) protected readonly matchManager: MatchManager,
        @inject(VSC_TYPES.VscCommands) protected readonly commands: VscCommands,
        @inject(TYPES.VersionControl) protected readonly versionControl: VersionControl,
        @inject(TYPES.MigrationHolderRemote) protected readonly migrationHolder: MigrationHolderRemote
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
        const stringifiedUri = stringify(matchUri);
        if (this.queue.includes(stringifiedUri)) {
            void this.window.showInformationMessage(`Match is already queued.`);
            return;
        }

        this.queue.push(stringifiedUri);
        try {
            await this.saveEditor(matchUri);
            await super.execute(matchUri);
            await this.applyChangesWithProgress(matchUri);
            await this.checkMigrationDone();
        } finally {
            const index = this.queue.indexOf(stringifiedUri);
            if (index > -1) {
                this.queue.splice(index, 1);
            }
        }
    }

    private applyChangesWithProgress(matchUri: Uri): Thenable<void> {
        const match = this.matchManager.byMatchUriOrThrow(matchUri);
        const previousExecution = this.lastExecution;

        const applyChanges = async (progress: Progress<{ message: string }>): Promise<void> => {
            if (previousExecution) {
                progress.report({ message: "Waiting for previous execution" });
                await this.waitForPreviousExecution(previousExecution, matchUri);
            }

            try {
                await this.applyChangesForMatch(matchUri, progress);
            } catch (error) {
                this.handleApplyError(error);
                this.lastExecution = undefined;
                throw error;
            }
        };

        return this.window.withProgress({
            title: `Applying Change ${match.match.label}`,
            location: ProgressLocation.Notification
        }, progress => this.lastExecution = applyChanges(progress));
    }

    private async waitForPreviousExecution(previousExecution: Thenable<void>, matchUri: Uri): Promise<void> {
        try {
            await previousExecution;
        } catch (error) {
            const match = this.matchManager.byMatchUriOrThrow(matchUri);
            void this.window.showErrorMessage(`Changes for match ${match.match.label} were not applied because the previous application failed.`);
            throw error;
        }
    }

    private async applyChangesForMatch(matchUri: Uri, progress: Progress<{ message?: string | undefined; increment?: number | undefined; }>): Promise<void> {
        const fileUri = toFileUri(matchUri);
        progress.report({ message: "Saving File" });
        const newContent = await this.changedContentProvider.readFile(matchUri);
        await this.workspace.fs.writeFile(fileUri, newContent);

        this.matchManager.resolveEntry(matchUri);

        progress.report({ message: "Running verification tasks" });
        await this.migrationHolder.verify();

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
