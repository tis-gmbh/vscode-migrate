import { injectable } from "inversify";
import { debug } from "vscode";
import { VscDebug } from "../../di/types";

@injectable()
export class DebugStub implements VscDebug {
    public startDebugging = debug.startDebugging;
    public stopDebugging = debug.stopDebugging;
    public removeBreakpoints = debug.removeBreakpoints;
    public breakpoints = debug.breakpoints;
}
