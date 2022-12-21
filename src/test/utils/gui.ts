import { VSC_TYPES } from "../../di/types";
import { MessageRecord, ProgressRecord, WindowStub } from "../stubs/window";

export function atNextQuickPickChoose(optionName: string): void {
    getWindow().atNextQuickPickChoose(optionName);
}

export function progressRecords(): ProgressRecord[] {
    return getWindow().progressRecords;
}

export function notificationRecords(): MessageRecord[] {
    return getWindow().notifications;
}

export function treeUpdates(): Array<Array<string | undefined>> {
    return getWindow().treeUpdates;
}

export function getWindow(): WindowStub {
    return scenario.get(VSC_TYPES.VscWindow);
}
