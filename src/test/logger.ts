import { mkdirSync, writeFileSync } from "fs";
import { injectable } from "inversify";
import { join } from "path";

@injectable()
export class Logger {
    private readonly logs: string[] = [];

    public log(message: string): void {
        this.logs.push(message);
    }

    public dumpLogs(fileName: string): void {
        const logDir = join(__dirname, "..", "..", "logs");
        try { mkdirSync(logDir); } catch { }
        writeFileSync(join(logDir, fileName + ".log"), this.logs.join("\r\n"));
    }
}
