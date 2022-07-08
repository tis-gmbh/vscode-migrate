import { inject, injectable } from "inversify";
import { OutputChannel } from "vscode";
import { VscWindow, VSC_TYPES } from "../di/types";

@injectable()
export class MigrationOutputChannel {
    private readonly outputChannel: OutputChannel;

    public constructor(
        @inject(VSC_TYPES.VscWindow) private readonly window: VscWindow
    ) {
        this.outputChannel = this.window.createOutputChannel("Migration");
    }

    public append(message: string): void {
        this.outputChannel.append(message);
    }

    public show(): void {
        this.outputChannel.show();
    }
}
