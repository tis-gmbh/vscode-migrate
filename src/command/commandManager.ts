import { inject, injectable, multiInject } from "inversify";
import * as vscode from "vscode";
import { TYPES, VscCommands, VSC_TYPES } from "../di/types";
import { Command } from "./command";

@injectable()
export class CommandManager {
    public constructor(
        @inject(VSC_TYPES.VscCommands) private readonly vscCommands: VscCommands,
        @multiInject(TYPES.Command) private readonly commands: Command[]
    ) { }

    public registerCommands(context: vscode.ExtensionContext): void {
        for (const c of this.commands) {
            const cmd = this.vscCommands.registerCommand(c.id, c.execute, c);
            context.subscriptions.push(cmd);
        }
    }
}
