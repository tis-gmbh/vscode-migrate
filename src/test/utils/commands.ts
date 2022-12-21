import { VSC_TYPES } from "../../di/types";
import { CommandRecord, CommandsStub } from "../stubs/commands";

export async function execute(commandId: string, ...args: any[]): Promise<any> {
    return getCommands().executeCommand(commandId, ...args);
}

export function commandRecords(): CommandRecord[] {
    return getCommands().commandRecords;
}

export function getCommands(): CommandsStub {
    return scenario.get<CommandsStub>(VSC_TYPES.VscCommands);
}
