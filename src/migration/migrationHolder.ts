import { inject, injectable } from "inversify";
import { EventEmitter } from "vscode";
import { TYPES, VscWindow, VSC_TYPES } from "../di/types";
import { CommitInfo, IMigration, MatchedFile } from "../migrationTypes";
import { MigrationLoader } from "./migrationLoader";
import { MigrationOutputChannel } from "./migrationOutputChannel";

@injectable()
export class MigrationHolder {
    private readonly changeEmitter = new EventEmitter<void>();
    public readonly migrationChanged = this.changeEmitter.event;
    private migrationName?: string;
    private migration?: IMigration;

    public constructor(
        @inject(VSC_TYPES.VscWindow) private readonly window: VscWindow,
        @inject(TYPES.MigrationLoader) private readonly migrationLoader: MigrationLoader,
        @inject(TYPES.MigrationOutputChannel) private readonly outputChannel: MigrationOutputChannel
    ) {
    }

    public async start(migrationName: string): Promise<void> {
        const factory = this.migrationLoader.getFactory(migrationName)!;
        try {
            this.migrationName = migrationName;
            this.migration = await factory();
        } catch (error) {
            this.handleMigrationError(error);
        }
        this.changeEmitter.fire();
    }

    public stop(): void {
        this.migrationName = undefined;
        this.migration = undefined;
        this.changeEmitter.fire();
    }

    public getName(): string | undefined {
        return this.migrationName;
    }

    public hasMigration(): boolean {
        return this.migration !== undefined;
    }

    public async getMatchedFiles(): Promise<MatchedFile[]> {
        try {
            return await this.migration?.getMatchedFiles() || [];
        } catch (error: any) {
            this.handleMigrationError(error);
            return [];
        }
    }

    public async getCommitMessage(commitInfo: CommitInfo): Promise<string | undefined> {
        try {
            return await this.migration?.getCommitMessage?.(commitInfo);
        } catch (error: any) {
            this.handleMigrationError(error);
            return undefined;
        }
    }

    public verify(): Promise<void> | void {
        // DO NOT catch any errors here, as a verification failure needs to be reported
        return this.migration?.verify?.();
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
