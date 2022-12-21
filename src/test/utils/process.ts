import { DebugProtocol } from "@vscode/debugprotocol";
import { debug, DebugAdapterTracker, DebugSession, Location, Position as SourcePosition, SourceBreakpoint, Uri } from "vscode";
import { TYPES, VscDebug, VSC_TYPES } from "../../di/types";
import { MigrationScriptProcessController } from "../../migrationScriptProcessController";
import { stringify } from "../../utils/uri";
import { Logger } from "../logger";
import { TEST_TYPES } from "../types";
import { execute } from "./commands";
import { updatePass } from "./events";
import { atNextQuickPickChoose } from "./gui";

export async function restartProcess(): Promise<void> {
    const pass = updatePass();
    await execute("vscode-migrate.restart-migration-script-process");
    await pass;
}

export async function killProcess(): Promise<void> {
    const migrationScriptProcessController = scenario.get<MigrationScriptProcessController>(TYPES.MigrationScriptProcessController);
    await migrationScriptProcessController.restart();
}

export function addBreakpoint(fileUri: Uri, position: SourcePosition): void {
    log(`Adding breakpoint at ${fileUri.fsPath}:${position.line}`);
    debug.addBreakpoints([new SourceBreakpoint(new Location(fileUri, position))]);
    log(`Added breakpoint at ${fileUri.fsPath}:${position.line}`);
}

export async function startDebugging(): Promise<void> {
    log("Starting debugging...");
    debug.registerDebugAdapterTrackerFactory("pwa-node", {
        createDebugAdapterTracker(): DebugAdapterTracker {
            const logger = scenario.get<Logger>(TEST_TYPES.Logger);
            return new LoggingDebugAdapterTracker(logger);
        }
    });

    await execute("vscode-migrate.debug-migration-script-process");
    log("Debugging started.");
}

export async function stopDebugging(): Promise<void> {
    log("Stopping debugging...");
    await execute("vscode-migrate.stop-debug-migration-script-process");
    log("Debugging stopped.");
}

export async function waitForBreakpointHit(): Promise<SourceBreakpoint> {
    return new Promise(res => {
        debug.registerDebugAdapterTrackerFactory("pwa-node", {
            createDebugAdapterTracker(session: DebugSession) {
                return {
                    async onDidSendMessage(message: any): Promise<void> {
                        if (message.type === "event"
                            && message.event === "stopped"
                            && message.body.reason === "breakpoint") {
                            const breakpointId = message.body.hitBreakpointIds[0];
                            const mappedBreakpoints = await Promise.all(debug.breakpoints.map(async breakpoint =>
                                session.getDebugProtocolBreakpoint(breakpoint)
                            ));
                            const breakpointIndex = mappedBreakpoints.findIndex(breakpoint =>
                                (breakpoint as any)?.id === breakpointId
                            );
                            const hitBreakpoint = debug.breakpoints[breakpointIndex] as SourceBreakpoint;
                            log("Hit breakpoint at " + stringify(hitBreakpoint.location.uri) + ":" + hitBreakpoint.location.range.start.line);
                            res(hitBreakpoint);
                        }
                    }
                };
            }
        });
    });
}

export function removeAllBreakpoints(): void {
    const debug = getDebug();
    debug.removeBreakpoints(debug.breakpoints);
}

export function getDebug(): VscDebug {
    return scenario.get(VSC_TYPES.VscDebug);
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

class LoggingDebugAdapterTracker implements DebugAdapterTracker {
    public constructor(
        private readonly logger: Logger
    ) { }

    private log(message: string): void {
        this.logger.log("Debug Adapter Tracker: " + message);
    }

    public onWillStartSession(): void {
        this.log("onWillStartSession");
    }

    public onWillStopSession(): void {
        this.log("onWillStopSession");
    }

    public onWillReceiveMessage(message: DebugProtocol.Request): void {
        this.log("Will receive request: " + JSON.stringify(message));
    }

    public onDidSendMessage(message: DebugProtocol.Response): void {
        this.log("Sent response: " + JSON.stringify(message));
    }

    public onError(error: Error): void {
        this.log("Error: " + error.message);
    }
}
