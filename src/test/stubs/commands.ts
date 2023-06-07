import { inject, injectable } from "inversify";
import { Disposable, Uri, commands } from "vscode";
import { VscCommands } from "../../di/types";
import { stringify } from "../../utils/uri";
import { Logger } from "../logger";
import { TEST_TYPES } from "../types";
import { AwaitEntryArray } from "../utils/awaitEntryArray";

export interface CommandRecord {
    id: string,
    args: any[],
    result?: any,
    error?: any
}

@injectable()
export class CommandsStub implements VscCommands {
    private readonly commands: Map<string, {
        callback: (...args: any[]) => any,
        thisArg?: any
    }> = new Map();
    public readonly commandRecords = new AwaitEntryArray<CommandRecord>();

    public constructor(
        @inject(TEST_TYPES.Logger) private readonly logger: Logger
    ) { }

    public async executeCommand(command: string, ...args: any[]): Promise<any> {
        this.logger.log(`Executing command ${command} with args ${args}`);
        const record: CommandRecord = {
            id: command,
            args: args.map(arg => arg instanceof Uri ? stringify(arg) : arg)
        };
        this.commandRecords.push(record);

        const commandInfo = this.commands.get(command);
        try {
            if (commandInfo) {
                record.result = await commandInfo.callback.apply(commandInfo.thisArg, args);
            } else {
                record.result = await commands.executeCommand(command, ...args);
            }

            this.logger.log(`Command ${command} with args ${args} finished with result ${record.result}`);
            return Promise.resolve();
        } catch (error) {
            record.error = error;
            this.logger.log(`Command ${command} with args ${args} failed with error ${JSON.stringify(error)} `);
            throw error;
        }
    };

    public registerCommand(command: string, callback: (...args: any[]) => any, thisArg?: any): Disposable {
        this.commands.set(command, {
            callback,
            thisArg
        });
        return new Disposable(() => {
            this.commands.delete(command);
        });
    }
}
