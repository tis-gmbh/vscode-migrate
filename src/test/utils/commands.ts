import { VSC_TYPES } from "../../di/types";
import { CommandRecord, CommandsStub } from "../stubs/commands";

export function execute(commandId: string, ...args: any[]): Promise<any> {
    return getCommands().executeCommand(commandId, ...args);
}

export function commandRecords(): CommandRecord[] {
    return getCommands().commandRecords;
}

export function commandRecord(criteria: Partial<CommandRecord>): Promise<CommandRecord> {
    return getCommands().commandRecords.awaitEntryMatching(criteria);
}

export function getCommands(): CommandsStub {
    return scenario.get<CommandsStub>(VSC_TYPES.VscCommands);
}
