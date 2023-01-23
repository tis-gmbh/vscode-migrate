import { ChildProcess, fork } from "child_process";
import { inject, injectable } from "inversify";
import { join } from "path";
import { EventEmitter } from "vscode";
import { RpcProvider } from "worker-rpc";
import { TYPES, VscWindow, VSC_TYPES } from "./di/types";
import { MigrationOutputChannel } from "./migration/migrationOutputChannel";
import { MigrationStdOutChannel } from "./migration/migrationStdOutChannel";
import { RPCInterface, RPCMethodNames } from "./rpcMethods";

type UnwrapPromise<T> = T extends Promise<infer U> ? U : T;

@injectable()
export class MigrationScriptProcessController {
    private rpcProvider?: RpcProvider;
    private child?: ChildProcess;
    private processEnd?: Promise<void>;
    private readonly restartEmitter = new EventEmitter<void>();
    public readonly restartEvent = this.restartEmitter.event;

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
        this.processEnd = new Promise((_res, rej) => {
            this.child!.on("exit", (exitCode, signal) => {
                this.child = undefined;
                this.rpcProvider = undefined;

                rej(new Error("Migration Script Process died."));
                this.announceProcessDeath(exitCode, signal);
                this.restartEmitter.fire();
            });
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
        this.rpcProvider = new RpcProvider(message => this.child!.send(message));
        this.rpcProvider.error.addHandler(error => {
            this.migrationOutputChannel.append(error.stack || error.message);
        });
        this.rpcProvider.registerRpcHandler("log", (message: string) => {
            this.migrationOutputChannel.append(message);
        });
        this.child.on("message", (message: RpcProvider.Message) => {
            if (message.payload?.isError) {
                message.payload = new Error(message.payload.message);
                message.payload.stack = message.payload.stack;
                message.payload.name = message.payload.name;
            }

            this.rpcProvider!.dispatch(message);
        });
    }

    public get isRunning(): boolean {
        return this.child !== undefined;
    }

    private announceProcessDeath(exitCode: number | null, signal: NodeJS.Signals | null): void {
        this.migrationStdOutChannel.append(`MigrationScriptProcess died with exit code ${exitCode} and signal ${signal}. \n`);
        void this.window.showWarningMessage("MigrationScriptProcess died.", "Show Output")
            .then(result => {
                if (result === "Show Output") {
                    this.migrationStdOutChannel.show();
                }
            });
    }

    public kill(): Promise<void> {
        return new Promise((res, rej) => {
            if (this.child?.kill()) {
                this.child = undefined;
                this.rpcProvider = undefined;
                res();
            } else {
                rej();
            }
        });
    }

    public async send<M extends RPCMethodNames>(methodName: M, ...args: Parameters<RPCInterface[M]>): Promise<UnwrapPromise<ReturnType<RPCInterface[M]>>> {
        if (!this.rpcProvider) {
            throw new Error("Migration Script Process is not running. Start a migration to spawn it.");
        }

        try {
            return await Promise.race([
                this.rpcProvider.rpc(methodName, args) as any,
                this.processEnd
            ]);
        } catch (e: any) {
            this.migrationOutputChannel.append(e.stack || e.message || "An unknown error occurred during rpc transmission.");
            throw e;
        }
    }
}
