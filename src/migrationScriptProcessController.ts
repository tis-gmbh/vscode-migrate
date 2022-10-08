import { ChildProcess, fork } from "child_process";
import { inject, injectable } from "inversify";
import { join } from "path";
import { TYPES } from "./di/types";
import { MigrationStdOutChannel } from "./migration/migrationStdOutChannel";

@injectable()
export class MigrationScriptProcessController {
    private invocationCounter = 0;
    private child = this.createChild();

    public constructor(
        @inject(TYPES.MigrationStdOutChannel) private readonly migrationStdOutChannel: MigrationStdOutChannel
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
        child.on("message", data => {
            console.log(data + "");
        });
        child.on("error", (data) => {
            console.log("Error in child process");
            console.error(data + "");
        });
        child.on("exit", (exitCode, signal) => {
            this.migrationStdOutChannel.append(`MigrationScriptProcess died with exit code ${exitCode} and signal ${signal}. Restarting.\n`);
            this.child = this.createChild();
        });
        return child;
    }

    public send(target: string, methodName: string, ...args: any[]): Promise<any> {
        const invocationId = this.invocationCounter++;
        return new Promise<any>((res, rej) => {
            const listener = (message: any): void => {
                try {
                    message = JSON.parse(message);
                    if (message.invocationId === invocationId) {
                        this.child.off("message", listener);

                        if (message.error) {
                            rej(message.error);
                        } else {
                            res(message.result);
                        }
                    }
                } catch (ignore) { }
            };
            this.child.on("message", listener);
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
}