import { inject, injectable } from "inversify";
import { VscDebug, VSC_TYPES } from "../di/types";
import { Command } from "./command";

@injectable()
export class StopDebugMigrationScriptProcessCommand implements Command {
    public readonly id = "vscode-migrate.stop-debug-migration-script-process";

    public constructor(
        @inject(VSC_TYPES.VscDebug) private readonly vscDebug: VscDebug
    ) {
    }

    public async execute(): Promise<void> {
        await this.vscDebug.stopDebugging();
    }
}
