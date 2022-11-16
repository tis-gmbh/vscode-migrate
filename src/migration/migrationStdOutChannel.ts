
import { inject, injectable } from "inversify";
import { OutputChannel } from "vscode";
import { VscWindow, VSC_TYPES } from "../di/types";

@injectable()
export class MigrationStdOutChannel {
    private readonly outputChannel: OutputChannel;

    public constructor(
        @inject(VSC_TYPES.VscWindow) private readonly window: VscWindow
    ) {
        this.outputChannel = this.window.createOutputChannel("MigrationStdOut");
    }

    public append(message: string): void {
        this.outputChannel.append(message);
    }

    public show(): void {
        this.outputChannel.show();
    }
}
