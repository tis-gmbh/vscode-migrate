import { VSC_TYPES } from "../../di/types";
import { Logger } from "../logger";
import { DebugStartRecord, DebugStub } from "../stubs/debug";
import { TEST_TYPES } from "../types";
import { execute } from "./commands";
import { updatePass } from "./events";
import { atNextQuickPickChoose } from "./gui";

export async function killProcess(): Promise<void> {
    const pass = updatePass();
    await execute("vscode-migrate.kill-migration-script-process");
    await pass;
}

export async function startDebugging(migrationName: string): Promise<void> {
    log("Starting debugging...");
    atNextQuickPickChoose(migrationName);
    await execute("vscode-migrate.debug-migration-script-process");
    log("Debugging started.");
}

export function getDebug(): DebugStub {
    return scenario.get(VSC_TYPES.VscDebug);
}

export function getDebugStarts(): DebugStartRecord[] {
    return getDebug().debugStarts;
}

export async function startMigration(migrationName: string): Promise<void> {
    log(`Starting migration ${migrationName}...`);
    atNextQuickPickChoose(migrationName);

    const pass = updatePass();
    await execute("vscode-migrate.start-migration");
    await pass;
    log(`Migration '${migrationName}' started.`);
}

export async function stopMigration(): Promise<void> {
    log("Stopping migration...");
    const pass = updatePass();
    await execute("vscode-migrate.stop-migration");
    await pass;
    log("Migration stopped.");
}

function log(message: string): void {
    const logger = scenario.get<Logger>(TEST_TYPES.Logger);
    logger.log("Debugging: " + message);
}
