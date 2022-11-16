import { inject, injectable } from "inversify";
import { TYPES, VscDebug, VSC_TYPES } from "../di/types";
import { MigrationScriptProcessController } from "../migrationScriptProcessController";
import { Command } from "./command";


@injectable()
export class DebugMigrationScriptProcessCommand implements Command {
    public readonly id = "vscode-migrate.debug-migration-script-process";

    public constructor(
        @inject(TYPES.MigrationScriptProcessController) private readonly migrationScriptProcessController: MigrationScriptProcessController,
        @inject(VSC_TYPES.VscDebug) private readonly vscDebug: VscDebug
    ) {
    }

    public async execute(): Promise<void> {
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
    }
}
