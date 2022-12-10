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
    private rpcProvider: RpcProvider = new RpcProvider(message => this.child.send(message));
    private child = this.createChild();
    private readonly restartEmitter = new EventEmitter<void>();
    public readonly restartEvent = this.restartEmitter.event;

    public constructor(
        @inject(TYPES.MigrationStdOutChannel) private readonly migrationStdOutChannel: MigrationStdOutChannel,
        @inject(TYPES.MigrationOutputChannel) private readonly migrationOutputChannel: MigrationOutputChannel,
        @inject(VSC_TYPES.VscWindow) private readonly window: VscWindow
    ) { }

    private createChild(): ChildProcess {
        const child = fork(join(__dirname, "migrationScriptProcess.js"), {
            stdio: [null, null, null, "ipc"],
            execArgv: ["--inspect=0"]
        });
        child.stdout?.on("data", (data) => {
            this.migrationStdOutChannel.append(data + "");
        });
        child.stderr?.on("error", (data) => {
            this.migrationStdOutChannel.append("ERROR: " + data);
        });
        child.stderr?.on("data", (data) => {
            this.migrationStdOutChannel.append("ERROR: " + data);
        });
        child.on("error", (data) => {
            this.migrationStdOutChannel.append("ERROR: " + data);
        });
        child.on("exit", (exitCode, signal) => {
            setTimeout(() => {
                this.announceProcessDeath(exitCode, signal);
                this.child = this.createChild();
                this.restartEmitter.fire();
            }, 100);
        });
        this.rpcProvider = new RpcProvider(message => this.child.send(message));
        this.rpcProvider.error.addHandler(error => {
            this.migrationOutputChannel.append(error.stack || error.message);
        });
        child.on("message", message => this.rpcProvider?.dispatch(message));
        return child;
    }

    private announceProcessDeath(exitCode: number | null, signal: NodeJS.Signals | null): void {
        this.migrationStdOutChannel.append(`MigrationScriptProcess died with exit code ${exitCode} and signal ${signal}. Restarting.\n`);
        void this.window.showWarningMessage("MigrationScriptProcess died and is being restarted.", "Show Output")
            .then(result => {
                if (result === "Show Output") {
                    this.migrationStdOutChannel.show();
                }
            });
    }

    public restart(): Promise<void> {
        return new Promise((res, rej) => {
            if (this.child.kill()) {
                res();
            } else {
                rej();
            }
        });
    }

    public async send<M extends RPCMethodNames>(methodName: M, ...args: Parameters<RPCInterface[M]>): Promise<UnwrapPromise<ReturnType<RPCInterface[M]>>> {
        try {
            return await this.rpcProvider.rpc(methodName, args) as any;
        } catch (e: any) {
            this.migrationOutputChannel.append(e.stack || e.message || "An unknown error occurred during rpc transmission.");
            throw e;
        }
    }
}
