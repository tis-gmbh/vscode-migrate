import { inject, injectable } from "inversify";
import { FileSystemProvider, Progress, ProgressLocation, Uri } from "vscode";
import { ApplyQueue } from "../applyQueue";
import { TYPES, VSC_TYPES, VscCommands, VscWindow, VscWorkspace } from "../di/types";
import { MatchManager } from "../migration/matchManger";
import { MigrationHolderRemote } from "../migration/migrationHolderRemote";
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
        @inject(TYPES.ApplyQueue) private readonly queue: ApplyQueue,
    ) {
        super();
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
            await this.closeCurrent(matchUri);
            await this.applyChangesWithProgress(matchUri);
            await this.checkMigrationDone();
        } catch (error) {
            this.handleApplyError(error);
        } finally {
            this.queue.remove(stringifiedUri);
            if (this.queue.isEmpty()) {
                this.queue.lastExecution = undefined;
            }
        }
    }

    private async closeCurrent(matchUri: Uri): Promise<void> {
        const active = this.window.activeTextEditor;
        if (active && stringify(active.document.uri) === stringify(matchUri)) {
            await this.commands.executeCommand("workbench.action.closeActiveEditor");
        }
    }

    private applyChangesWithProgress(matchUri: Uri): Thenable<void> {
        const match = this.matchManager.byMatchUriOrThrow(matchUri);

        if (this.queue.isPreviousExecutionRunning()) {
            return Promise.reject(new Error(`Previous execution is still running.`));
        }

        const applyChanges = async (progress: Progress<{ message: string }>): Promise<void> => {
            const previousExecution = this.queue.lastExecution;
            if (previousExecution) {
                progress.report({ message: "Waiting for previous execution" });
                await this.waitForPreviousExecution(previousExecution, matchUri);
            }

            try {
                await this.applyChangesForMatch(matchUri, progress);
            } catch (error) {
                this.handleApplyError(error);
                this.queue.lastExecution = undefined;
                throw error;
            }
        };

        return this.window.withProgress({
            title: `Applying Change ${match.match.label}`,
            location: ProgressLocation.Notification
        }, progress => this.queue.lastExecution = applyChanges(progress));
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

    private handleVerifyError(error: any): void {
        const errorMessage = error.message || error;
        const message = `Failed to run verification tasks, the following error was thrown: ${errorMessage}`;
        throw new Error(message);
    }

    private handleApplyError(error: any): void {
        const errorMessage = error.message || error;
        void this.window.showErrorMessage("Failed to apply. Reason: " + errorMessage);
    }

    private async checkMigrationDone(): Promise<void> {
        if (this.matchManager.allResolved) {
            await this.migrationHolder.stop();
        }
    }
}
