import { inject, injectable } from "inversify";
import { TYPES } from "../di/types";
import { MigrationScriptProcessController } from "../migrationScriptProcessController";
import { Command } from "./command";

@injectable()
export class KillMigrationScriptProcessCommand implements Command {
    public readonly id = "vscode-migrate.kill-migration-script-process";

    public constructor(
        @inject(TYPES.MigrationScriptProcessController) private readonly migrationScriptProcessController: MigrationScriptProcessController
    ) { }

    public async execute(): Promise<void> {
        await this.migrationScriptProcessController.kill();
    }
}
