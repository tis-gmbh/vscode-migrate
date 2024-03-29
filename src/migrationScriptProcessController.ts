import { ChildProcess, fork } from "child_process";
import { inject, injectable } from "inversify";
import { join } from "path";
import { EventEmitter } from "vscode";
import { RpcProvider } from "worker-rpc";
import { TYPES, VSC_TYPES, VscWindow } from "./di/types";
import { MigrationOutputChannel } from "./migration/migrationOutputChannel";
import { MigrationStdOutChannel } from "./migration/migrationStdOutChannel";
import { RPCInterface, RPCMethodNames } from "./rpcMethods";

type UnwrapPromise<T> = T extends Promise<infer U> ? U : T;

@injectable()
export class MigrationScriptProcessController {
    private rpcProvider?: RpcProvider;
    private child?: ChildProcess;
    private readonly deathEmitter = new EventEmitter<void>();
    public readonly deathEvent = this.deathEmitter.event;
    private deathExpected = false;

    public constructor(
        @inject(TYPES.MigrationStdOutChannel) private readonly migrationStdOutChannel: MigrationStdOutChannel,
        @inject(TYPES.MigrationOutputChannel) private readonly migrationOutputChannel: MigrationOutputChannel,
        @inject(VSC_TYPES.VscWindow) private readonly window: VscWindow
    ) { }

    public async spawn(): Promise<void> {
        await this.spawnWithArgs([]);
    }

    public async spawnWithDebugger(): Promise<void> {
        await this.spawnWithArgs(["--inspect=0"]);
    }

    private async spawnWithArgs(execArgv: string[]): Promise<void> {
        try { await this.kill(); } catch { }
        this.child = fork(join(__dirname, "migrationScriptProcess.js"), {
            stdio: [null, null, null, "ipc"],
            execArgv
        });
        this.child!.on("exit", (exitCode, signal) => {
            this.child = undefined;
            this.rpcProvider = undefined;

            this.announceProcessDeath(exitCode, signal);
            this.deathEmitter.fire();
        });
        this.child.stdout?.on("data", (data) => {
            this.migrationStdOutChannel.append(data + "");
        });
        this.child.stderr?.on("error", (data) => {
            this.migrationStdOutChannel.append("ERROR: " + data);
        });
        this.child.stderr?.on("data", (data) => {
            this.migrationStdOutChannel.append("ERROR: " + data);
        });
        this.child.on("error", (data) => {
            this.migrationStdOutChannel.append("ERROR: " + data);
        });
        const rpcProvider = new RpcProvider(message => this.child!.send(message));
        this.rpcProvider = rpcProvider;
        rpcProvider.error.addHandler(error => {
            this.migrationOutputChannel.append(error.stack || error.message);
        });
        rpcProvider.registerRpcHandler("log", (message: string) => {
            this.migrationOutputChannel.append(message);
        });
        this.child.on("message", (message: RpcProvider.Message) => {
            if (message.payload?.isError) {
                message.payload = new Error(message.payload.message);
                message.payload.stack = message.payload.stack;
                message.payload.name = message.payload.name;
            }

            rpcProvider.dispatch(message);
        });
    }

    public get isRunning(): boolean {
        return this.child !== undefined;
    }

    private announceProcessDeath(exitCode: number | null, signal: NodeJS.Signals | null): void {
        this.migrationStdOutChannel.append(`MigrationScriptProcess died with exit code ${exitCode} and signal ${signal}. \n`);
        if (this.deathExpected) return;
        void this.window.showWarningMessage("MigrationScriptProcess died.", "Show Output")
            .then(result => {
                if (result === "Show Output") {
                    this.migrationStdOutChannel.show();
                }
            });
    }

    public kill(): Promise<void> {
        this.migrationStdOutChannel.append("Killing MigrationScriptProcess.\n");
        return new Promise(async (res, rej) => {
            this.deathExpected = true;
            const processDeath = new Promise(res => this.deathEvent(res));
            if (this.child?.kill()) {
                await processDeath;
                this.deathExpected = false;
                res();
            } else {
                rej();
            }
        });
    }

    public send<M extends RPCMethodNames>(methodName: M, ...args: Parameters<RPCInterface[M]>): Promise<UnwrapPromise<ReturnType<RPCInterface[M]>>> {
        if (!this.rpcProvider) {
            throw new Error("Migration Script Process is not running. Start a migration to spawn it.");
        }

        try {
            return new Promise((res, rej) => {
                (this.rpcProvider!.rpc(methodName, args) as any).then(res, rej);
                this.deathEvent(() => rej(new Error("Migration Script Process died.")));
            });
        } catch (e: any) {
            this.migrationOutputChannel.append(e.stack || e.message || "An unknown error occurred during rpc transmission.");
            throw e;
        }
    }
}
