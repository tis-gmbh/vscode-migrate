import { inject, injectable } from "inversify";
import { EventEmitter } from "vscode";
import { TYPES, VscWindow, VSC_TYPES } from "../di/types";
import { MigrationScriptProcessController } from "../migrationScriptProcessController";
import { CommitInfo, MatchedFile } from "../migrationTypes";
import { MigrationOutputChannel } from "./migrationOutputChannel";

@injectable()
export class MigrationHolderRemote {
    private readonly changeEmitter = new EventEmitter<void>();
    public readonly migrationChanged = this.changeEmitter.event;

    public constructor(
        @inject(VSC_TYPES.VscWindow) private readonly window: VscWindow,
        @inject(TYPES.MigrationOutputChannel) private readonly outputChannel: MigrationOutputChannel,
        @inject(TYPES.MigrationScriptProcessController) private readonly migrationProcess: MigrationScriptProcessController
    ) {
        this.migrationProcess.restartEvent(() => this.changeEmitter.fire());
    }

    public async start(migrationName: string): Promise<void> {
        try {
            await this.migrationProcess.send("startMigration", migrationName);
        } catch (error) {
            this.handleMigrationError(error);
            throw error;
        }
        this.changeEmitter.fire();
    }

    public async stop(): Promise<void> {
        await this.migrationProcess.send("stopMigration");
        await this.migrationProcess.kill();
        this.changeEmitter.fire();
    }

    public async getName(): Promise<string | undefined> {
        return await this.migrationProcess.send("getMigrationName");
    }

    public isRunning(): boolean {
        return this.migrationProcess.isRunning;
    }

    public async hasMigration(): Promise<boolean> {
        if (!this.isRunning()) return false;
        if (await this.getName() === undefined) return false;
        return true;
    }

    public async getMatchedFiles(): Promise<MatchedFile[]> {
        try {
            return await this.migrationProcess.send("getMatchedFiles");
        } catch (error: any) {
            this.handleMigrationError(error);
            return [];
        }
    }

    public async getCommitMessage(commitInfo: CommitInfo): Promise<string | undefined> {
        try {
            return await this.migrationProcess.send("getCommitMessage", commitInfo);
        } catch (error: any) {
            this.handleMigrationError(error);
            return undefined;
        }
    }

    public verify(): Promise<void> | void {
        // DO NOT catch any errors here, as a verification failure needs to be reported
        return this.migrationProcess.send("verify");
    }

    private handleMigrationError(error: any): void {
        this.outputChannel.append("Migration threw an error: " + error.stack);
        void this.window.showErrorMessage(`Migration threw an error. Check the output for details.`, "Show Output")
            .then(result => {
                if (result === "Show Output") {
                    this.outputChannel.show();
                }
            });
    }
}
