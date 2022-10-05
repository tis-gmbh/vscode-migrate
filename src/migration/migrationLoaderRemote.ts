import { inject, injectable } from "inversify";
import { basename } from "path";
import { Progress, ProgressLocation } from "vscode";
import { TYPES, VscWindow, VscWorkspace, VSC_TYPES } from "../di/types";
import { MigrationScriptProcessController } from "../migrationScriptProcessController";
import { MigrationOutputChannel } from "./migrationOutputChannel";

@injectable()
export class MigrationLoaderRemote {
    private progress?: Progress<{ message: string }>;

    public constructor(
        @inject(VSC_TYPES.VscWorkspace) private readonly workspace: VscWorkspace,
        @inject(VSC_TYPES.VscWindow) private readonly window: VscWindow,
        @inject(TYPES.MigrationOutputChannel) private readonly outputChannel: MigrationOutputChannel,
        @inject(TYPES.MigrationScriptProcessController) private readonly migrationProcess: MigrationScriptProcessController
    ) { }

    public refresh(): Thenable<void> {
        return this.window.withProgress({
            title: "Looking for migrations",
            location: ProgressLocation.Notification,
            cancellable: false
        }, async (progress) => {
            this.progress = progress;
            this.updateProgress("Finding files...");
            const errors = await this.migrationProcess.send("migrationLoader", "refresh");
            for (const [file, error] of Object.entries(errors)) {
                this.handleMigrationLoadError(file, error);
            }
        });
    }

    private updateProgress(message: string): void {
        this.progress?.report({ message: message });
    }

    private handleMigrationLoadError(file: string, error: any): void {
        this.outputChannel.append(`Failed to load file ${basename(file)}: ${error.stack}`);
        void this.window.showErrorMessage(`Failed to load ${basename(file)}. Check the output for details.`, "Show Output")
            .then(result => {
                if (result === "Show Output") {
                    this.outputChannel.show();
                }
            });
    }

    public getNames(): Promise<string[]> {
        return this.migrationProcess.send("migrationLoader", "getNames");
    }
}
