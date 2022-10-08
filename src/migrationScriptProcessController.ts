import { ChildProcess, fork } from "child_process";
import { injectable } from "inversify";
import { join } from "path";

@injectable()
export class MigrationScriptProcessController {
    private invocationCounter = 0;
    private child = this.createChild();

    private createChild(): ChildProcess {
        const child = fork(join(__dirname, "migrationScriptProcess.js"), {
            stdio: [null, null, null, "ipc"],
            execArgv: ["--inspect=0"]
        });
        child.stdout?.on("data", (data) => {
            console.log(data + "");
        });
        child.stderr?.on("error", (data) => {
            console.error(data + "");
        });
        child.stderr?.on("data", (data) => {
            console.error(data + "");
        });
        child.on("message", data => {
            console.log(data + "");
        });
        child.on("error", (data) => {
            console.log("Error in child process");
            console.error(data + "");
        });
        child.on("close", (exitCode, signal) => {
            console.log(`MigrationScriptProcess is exiting with exit code ${exitCode} and signal ${signal}`);
        });
        child.on("exit", (exitCode, signal) => {
            console.log(`MigrationScriptProcess died with exit code ${exitCode} and signal ${signal}. Restarting.`);
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