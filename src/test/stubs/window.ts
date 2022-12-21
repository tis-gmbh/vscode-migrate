import { inject, injectable } from "inversify";
import { CancellationToken, Disposable, MessageOptions, OutputChannel, Progress, ProgressOptions, TreeDataProvider, window } from "vscode";
import { VscWindow } from "../../di/types";
import { Logger } from "../logger";
import { TEST_TYPES } from "../types";

type ShowQuickPickParams = Parameters<VscWindow["showQuickPick"]>;

@injectable()
export class WindowStub implements VscWindow {
    public createTextEditorDecorationType = window.createTextEditorDecorationType;
    public visibleTextEditors = window.visibleTextEditors;
    public onDidChangeVisibleTextEditors = window.onDidChangeVisibleTextEditors;

    public showInformationMessage = this.createMessageLogger("showInformationMessage");
    public showErrorMessage = this.createMessageLogger("showErrorMessage");
    public showWarningMessage = this.createMessageLogger("showWarningMessage");

    public readonly notifications: MessageRecord[] = [];
    public readonly progressRecords: ProgressRecord[] = [];
    public readonly treeUpdates: Array<any[]> = [];

    public nextQuickPickOption?: string = undefined;

    public constructor(
        @inject(TEST_TYPES.Logger) private readonly logger: Logger
    ) { }

    private createMessageLogger<N extends "showInformationMessage" | "showErrorMessage" | "showWarningMessage">(original: N): VscWindow[N] {
        return (message: string, options: string | MessageOptions, ...restOptions: string[]): Thenable<any> => {
            this.notifications.push({
                level: original === "showInformationMessage" ? "info" :
                    original === "showErrorMessage" ? "error" : "warn",
                message,
                actions: typeof options === "string" ? [options, ...restOptions] : [],
                options: typeof options === "string" ? undefined : options
            });
            return new Promise(() => { });
        };
    }

    public createOutputChannel(): OutputChannel {
        return {
            name: "test",
            append: (value: string): void => {
                this.logger.log("MigrationOutputChannel (append): " + value);
            },
            appendLine: (): void => { },
            clear: (): void => { },
            replace: (): void => { },
            show: (): void => { },
            hide: (): void => { },
            dispose: (): void => { }
        };
    }

    public async withProgress<R>(_options: ProgressOptions, task: (progress: Progress<{ message?: string; increment?: number }>, token: CancellationToken) => Thenable<R>): Promise<R> {
        const record: ProgressRecord = {
            messages: [],
            done: false
        };

        this.progressRecords.push(record);

        const result = await task({
            report: (update): void => {
                record.messages.push(update.message!);
            }
        }, {
            isCancellationRequested: false,
            onCancellationRequested: (): Disposable => {
                return new Disposable(() => { });
            }
        });
        record.done = true;
        return result;
    }

    public async showQuickPick(items: any): Promise<any> {
        if (this.nextQuickPickOption === undefined) {
            throw new Error(`Not able to handle quick pick, because no option to choose was set beforehand. Available options are: ${(await items).join(", ")}`);
        }
        const chosenOption = this.nextQuickPickOption;
        this.nextQuickPickOption = undefined;
        return Promise.resolve(chosenOption);
    }

    public atNextQuickPickChoose(optionName: string): void {
        this.nextQuickPickOption = optionName;
    }

    public registerTreeDataProvider<T>(viewId: string, treeDataProvider: TreeDataProvider<T>): Disposable {
        if (viewId === "vscode-migrate.queued-matches") {
            treeDataProvider.onDidChangeTreeData!((...args) => this.treeUpdates.push(args));
        }
        return window.registerTreeDataProvider(viewId, treeDataProvider);
    }
}

export interface ProgressRecord {
    messages: string[]
    done: boolean;
}


export interface MessageRecord {
    level: "info" | "warn" | "error",
    message: string,
    actions: string[],
    options?: MessageOptions
}
