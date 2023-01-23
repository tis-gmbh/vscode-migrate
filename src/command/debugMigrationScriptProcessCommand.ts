import { inject, injectable } from "inversify";
import { TYPES, VscCommands, VscDebug, VscWindow, VSC_TYPES } from "../di/types";
import { MatchManager } from "../migration/matchManger";
import { MigrationHolderRemote } from "../migration/migrationHolderRemote";
import { MigrationLoaderRemote } from "../migration/migrationLoaderRemote";
import { MigrationScriptProcessController } from "../migrationScriptProcessController";
import { Command } from "./command";
import { StartMigrationCommand } from "./startMigrationCommand";


@injectable()
export class DebugMigrationScriptProcessCommand extends StartMigrationCommand implements Command {
    public readonly id = "vscode-migrate.debug-migration-script-process";

    public constructor(
        @inject(VSC_TYPES.VscDebug) private readonly vscDebug: VscDebug,
        @inject(TYPES.MigrationScriptProcessController) migrationScriptProcessController: MigrationScriptProcessController,
        @inject(VSC_TYPES.VscWindow) window: VscWindow,
        @inject(VSC_TYPES.VscCommands) commands: VscCommands,
        @inject(TYPES.MigrationHolderRemote) migrationHolder: MigrationHolderRemote,
        @inject(TYPES.MigrationLoaderRemote) migrationLoader: MigrationLoaderRemote,
        @inject(TYPES.MatchManager) matchManager: MatchManager
    ) {
        super(window, commands, migrationHolder, migrationLoader, matchManager, migrationScriptProcessController);
    }

    public async execute(): Promise<void> {
        await this.migrationScriptProcessController.spawnWithDebugger();
        const debugPort = await this.migrationScriptProcessController.send("getDebugPort");

        await this.vscDebug.startDebugging(undefined, {
            type: "pwa-node",
            request: "attach",
            name: "Attach to Migration Script Process",
            port: debugPort,
            protocol: "inspector",
            skipFiles: [
                "<node_internals>/**"
            ],
            pauseForSourceMap: true
        });

        await super.startMigration();
    }
}
