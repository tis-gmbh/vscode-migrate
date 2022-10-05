import { ChildProcess, fork } from "child_process";
import { injectable } from "inversify";
import { join } from "path";

@injectable()
export class MigrationScriptProcessController {
    private invocationCounter = 0;
    private child = this.createChild();

    private createChild(): ChildProcess {
        const child = fork(join(__dirname, "./migrationScriptProcess"), {
            stdio: ["pipe", "pipe", "pipe", "ipc"]
        });
        child.stdout?.on("message", (data) => console.log(new String(data)));
        child.stderr?.on("message", (data) => console.error(new String(data)));
        child.on("exit", () => {
            this.child = this.createChild();
        });
        return child;
    }

    public send(target: string, methodName: string, ...args: any[]): Promise<any> {
        const invocationId = this.invocationCounter++;
        return new Promise<any>((res, rej) => {
            const listener = (message: any): void => {
                if (message.invocationId === invocationId) {
                    this.child.off("message", listener);

                    if (message.error) {
                        rej(message.error);
                    } else {
                        res(message.result);
                    }
                }
            };
            this.child.on("message", listener);
            this.child.send({
                invocationId: invocationId,
                target,
                methodName,
                args
            });
        });
    }
}