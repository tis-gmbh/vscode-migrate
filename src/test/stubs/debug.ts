import { injectable } from "inversify";
import { Breakpoint, DebugConfiguration, DebugSession, DebugSessionOptions, WorkspaceFolder } from "vscode";
import { VscDebug } from "../../di/types";

export interface DebugStartRecord {
    folder: WorkspaceFolder | undefined;
    nameOrConfiguration: string | DebugConfiguration;
    parentSessionOrOptions?: DebugSession | DebugSessionOptions | undefined;
}

@injectable()
export class DebugStub implements VscDebug {
    public debugStarts: DebugStartRecord[] = [];

    public startDebugging(folder: WorkspaceFolder | undefined, nameOrConfiguration: string | DebugConfiguration, parentSessionOrOptions?: DebugSession | DebugSessionOptions | undefined): Thenable<boolean> {
        this.debugStarts.push({ folder, nameOrConfiguration, parentSessionOrOptions });
        return Promise.resolve(true);
    }
}
