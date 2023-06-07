import { Container } from "inversify";
import { ExtensionContext } from "vscode";
import { modules, vscCommands, vscModules } from "./di/inversify.config";
import { TYPES } from "./di/types";
import { VSCodeMigrate } from "./vscodeMigrate";

const container = new Container();
export function activate(context: ExtensionContext): void {
    container.load(modules, vscModules, vscCommands);
    const vsCodeMigrate = container.get<VSCodeMigrate>(TYPES.VscMigrate);
    void vsCodeMigrate.activate(context);
}

export async function deactivate(): Promise<void> {
    await container.unbindAllAsync();
}
