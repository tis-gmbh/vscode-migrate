import { Container } from "inversify";
import { ExtensionContext } from "vscode";
import { modules, vscCommands, vscModules } from "./di/inversify.config";
import { TYPES } from "./di/types";
import { VSCodeMigrate } from "./vscodeMigrate";

export function activate(context: ExtensionContext): void {
    const container = new Container();
    container.load(modules, vscModules, vscCommands);
    const vsCodeMigrate = container.get<VSCodeMigrate>(TYPES.VscMigrate);
    void vsCodeMigrate.activate(context);
}

export function deactivate(): void { }
