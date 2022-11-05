import { CommitInfo, IMigration, MatchedFile } from "../migrationTypes";
import { MigrationLoader } from "./migrationLoader";

export class MigrationHolder {
    private migrationName?: string;
    private migration?: IMigration;

    public constructor(
        private readonly migrationLoader: MigrationLoader,
    ) {
    }

    public async start(migrationName: string): Promise<void> {
        const factory = this.migrationLoader.getFactory(migrationName)!;
        this.migrationName = migrationName;
        this.migration = await factory();
    }

    public stop(): void {
        this.migrationName = undefined;
        this.migration = undefined;
    }

    public getName(): string | undefined {
        return this.migrationName;
    }

    public hasMigration(): boolean {
        return this.migration !== undefined;
    }

    public async getMatchedFiles(): Promise<MatchedFile[]> {
        return await this.migration!.getMatchedFiles();
    }

    public async getCommitMessage(commitInfo: CommitInfo): Promise<string | undefined> {
        return await this.migration!.getCommitMessage?.(commitInfo);
    }

    public async verify(): Promise<void> {
        await this.migration!.verify?.();
    }
}
