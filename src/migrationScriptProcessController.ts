import { ChildProcess, fork, Serializable } from "child_process";
import { inject, injectable } from "inversify";
import { join } from "path";
import { TYPES, VscWindow, VSC_TYPES } from "./di/types";
import { MigrationOutputChannel } from "./migration/migrationOutputChannel";
import { MigrationStdOutChannel } from "./migration/migrationStdOutChannel";

type SuccessListener = (result: any) => void;
type ErrorListener = (error: any) => void;

@injectable()
export class MigrationScriptProcessController {
    private invocationCounter = 0;
    private child = this.createChild();
    private invocationListeners: Record<number, [SuccessListener, ErrorListener]> = {};

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
            this.migrationStdOutChannel.append(`MigrationScriptProcess died with exit code ${exitCode} and signal ${signal}. Restarting.\n`);
            void this.window.showWarningMessage("MigrationScriptProcess died and is being restarted.", "Show Output")
                .then(result => {
                    if (result === "Show Output") {
                        this.migrationStdOutChannel.show();
                    }
                });
            this.child = this.createChild();
        });
        child.on("message", message => this.processMessage(message));
        return child;
    }

    private processMessage(message: Serializable): void {
        try {
            const parsedMessage = JSON.parse(message.toString());

            const invocationId = parsedMessage.invocationId;
            const handlers = this.invocationListeners[invocationId];

            if (!handlers) {
                return;
            }

            if (parsedMessage.error) {
                handlers[1](parsedMessage.error);
            } else {
                handlers[0](parsedMessage.result);
            }
        } catch (error) {
            this.migrationOutputChannel.append("Failed to parse message: " + message);
        }
    }

    public send(target: string, methodName: string, ...args: any[]): Promise<any> {
        const invocationId = this.invocationCounter++;
        return new Promise<any>((res, rej) => {
            this.registerInvocationListener(invocationId, res, rej);
            try {
                this.child.send({
                    invocationId: invocationId,
                    target,
                    methodName,
                    args
                });
            } catch (error) {
                rej(error);
            }
        });
    }

    private registerInvocationListener(
        invocationId: number,
        onSuccess: SuccessListener,
        onError: ErrorListener
    ): void {
        this.invocationListeners[invocationId] = [onSuccess, onError];
    }
}