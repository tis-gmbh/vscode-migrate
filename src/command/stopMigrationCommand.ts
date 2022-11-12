import { inject, injectable } from "inversify";
import { TYPES } from "../di/types";
import { MigrationHolderRemote } from "../migration/migrationHolderRemote";
import { Command } from "./command";

@injectable()
export class StopMigrationCommand implements Command {
    public readonly id = "vscode-migrate.stop-migration";
    public static isRunning = false;

    public constructor(
        @inject(TYPES.MigrationHolderRemote) private readonly migrationHolder: MigrationHolderRemote
    ) { }

    public async execute(): Promise<void> {
        await this.migrationHolder.stop();
    }
}
