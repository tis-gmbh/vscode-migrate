import { inject, injectable } from "inversify";
import { EventEmitter, OutputChannel } from "vscode";
import { TYPES, VscWindow, VSC_TYPES } from "../di/types";
import { IMigration, MatchedFile } from "../migrationTypes";
import { MigrationLoader } from "./migrationLoader";

@injectable()
export class MigrationHolder {
    private readonly changeEmitter = new EventEmitter<void>();
    public readonly migrationChanged = this.changeEmitter.event;
    private migrationName?: string;
    private migration?: IMigration;

    private readonly outputChannel: OutputChannel;

    public constructor(
        @inject(VSC_TYPES.VscWindow) private readonly window: VscWindow,
        @inject(TYPES.MigrationLoader) private readonly migrationLoader: MigrationLoader,
    ) {
        this.outputChannel = this.window.createOutputChannel("Migration");
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

    public verify(): Promise<void> | void {
        // DO NOT catch any errors here, as a verification failure needs to be reported
        return this.migration?.verify?.();
    }

    private handleMigrationError(error: any): void {
        void this.window.showErrorMessage(`Migration threw an error. Check the output for details.`);
        this.outputChannel.append(error.stack);
    }
}
