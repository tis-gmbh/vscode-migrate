import { inject, injectable } from "inversify";
import { TYPES } from "../di/types";
import { MigrationScriptProcessController } from "../migrationScriptProcessController";
import { Command } from "./command";

@injectable()
export class RestartMigrationScriptProcessCommand implements Command {
    public readonly id = "vscode-migrate.restart-migration-script-process";

    public constructor(
        @inject(TYPES.MigrationScriptProcessController) private readonly migrationScriptProcessController: MigrationScriptProcessController
    ) { }

    public async execute(): Promise<void> {
        await this.migrationScriptProcessController.restart();
    }
}
