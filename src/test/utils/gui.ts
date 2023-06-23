import { VSC_TYPES } from "../../di/types";
import { Criteria } from "../../utils/matches";
import { MessageRecord, ProgressRecord, WindowStub } from "../stubs/window";

export function atNextQuickPickChoose(optionName: string): void {
    getWindow().atNextQuickPickChoose(optionName);
}

export function progressRecords(): ProgressRecord[] {
    return getWindow().progressRecords;
}

export function message(criteria: Criteria<MessageRecord>): Promise<MessageRecord> {
    return getWindow().messageRecords.awaitEntryMatching(criteria);
}

export function progress(criteria: Criteria<ProgressRecord>): Promise<ProgressRecord> {
    return getWindow().progressRecords.awaitEntryMatching(criteria);
}

export function treeUpdates(): Array<Array<string | undefined>> {
    const updates = getWindow().treeUpdates["vscode-migrate.all-matches"];
    return updates?.[updates.length - 1] || [];
}

export function getWindow(): WindowStub {
    return scenario.get(VSC_TYPES.VscWindow);
}
