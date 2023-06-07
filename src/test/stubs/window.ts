import { inject, injectable } from "inversify";
import { CancellationToken, Disposable, MessageOptions, OutputChannel, Progress, ProgressOptions, TreeDataProvider, TreeItem, TreeItemLabel, window } from "vscode";
import { VscWindow } from "../../di/types";
import { Logger } from "../logger";
import { TEST_TYPES } from "../types";
import { AwaitEntryArray } from "../utils/awaitEntryArray";

@injectable()
export class WindowStub implements VscWindow {
    public createTextEditorDecorationType = window.createTextEditorDecorationType;
    public visibleTextEditors = window.visibleTextEditors;
    public onDidChangeVisibleTextEditors = window.onDidChangeVisibleTextEditors;

    public showInformationMessage = this.createMessageLogger("showInformationMessage");
    public showErrorMessage = this.createMessageLogger("showErrorMessage");
    public showWarningMessage = this.createMessageLogger("showWarningMessage");

    public readonly messageRecords = new AwaitEntryArray<MessageRecord>();
    public readonly progressRecords = new AwaitEntryArray<ProgressRecord>();
    public readonly displayedTrees: Record<string, AwaitEntryArray<Record<string, string[]> | Error>> = {};
    public readonly treeUpdates: Record<string, AwaitEntryArray<any[]>> = {};

    public nextQuickPickOption?: string = undefined;

    public constructor(
        @inject(TEST_TYPES.Logger) private readonly logger: Logger
    ) { }

    private createMessageLogger<N extends "showInformationMessage" | "showErrorMessage" | "showWarningMessage">(original: N): VscWindow[N] {
        return (message: string, options: string | MessageOptions, ...restOptions: string[]): Thenable<any> => {
            return new Promise(res => {
                const newNotification: MessageRecord = {
                    level: original === "showInformationMessage" ? "info" :
                        original === "showErrorMessage" ? "error" : "warn",
                    message,
                    actions: typeof options === "string" ? [options, ...restOptions] : [],
                    options: typeof options === "string" ? undefined : options,
                    choose: res
                };
                this.logger.log("New Message: " + JSON.stringify(newNotification, null, 2));
                this.messageRecords.push(newNotification);
            });
        };
    }

    public createOutputChannel(name: string): OutputChannel {
        const append = (value: string): void => {
            this.logger.log(name + " (append): " + value);
        };

        return {
            name,
            append,
            appendLine: (value: string): void => append(value + "\n"),
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
                this.logger.log("Progress update: " + JSON.stringify(update, null, 2));
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
        this.logger.log(`Quick pick shown, choosing: ${this.nextQuickPickOption}`);
        const chosenOption = this.nextQuickPickOption;
        this.nextQuickPickOption = undefined;
        return Promise.resolve(chosenOption);
    }

    public atNextQuickPickChoose(optionName: string): void {
        this.nextQuickPickOption = optionName;
    }

    public registerTreeDataProvider<T>(viewId: string, treeDataProvider: TreeDataProvider<T>): Disposable {
        const updateHistory = new AwaitEntryArray<any[]>();
        const treeHistory = new AwaitEntryArray<Record<string, string[]> | Error>();

        this.treeUpdates[viewId] = updateHistory;
        this.displayedTrees[viewId] = treeHistory;

        const processTreeUpdate = async (...args: any[]): Promise<void> => {
            updateHistory.push(args);
            let displayedTree: Record<string, any> | Error;
            try {
                displayedTree = await getDisplayedTree(treeDataProvider as unknown as TreeDataProvider<string>);
            } catch (e) {
                displayedTree = e as Error;
            }
            this.logger.log(`Tree update of '${viewId}' with args ${JSON.stringify(args)}, leading to displayed tree: ${JSON.stringify(displayedTree, null, 2)}`);
            treeHistory.push(displayedTree);
        };
        void processTreeUpdate();
        return treeDataProvider.onDidChangeTreeData!(processTreeUpdate);
    }
}

async function getDisplayedTree(treeProvider: TreeDataProvider<string>): Promise<Record<string, string[]>> {
    const children = await treeProvider.getChildren();
    if (!children) return {};

    const tree: Record<string, string[]> = {};
    for (const element of children) {
        const item = await treeProvider.getTreeItem(element);
        const childLabels = await getChildLabelsOf(treeProvider, element);

        tree[stringifyLabel(item.label)] = childLabels;
    }

    return tree;
}

async function getChildLabelsOf(treeProvider: TreeDataProvider<string>, treeElement: string): Promise<string[]> {
    return (await getTreeItemsOf(treeProvider, treeElement))
        .map(i => stringifyLabel(i.label));
}

async function getTreeItemsOf(treeProvider: TreeDataProvider<string>, treeElement: string): Promise<TreeItem[]> {
    const children = (await treeProvider.getChildren(treeElement)) || [];
    return Promise.all(children.map(c => treeProvider.getTreeItem(c)));
}

function stringifyLabel(label: string | TreeItemLabel | undefined): string {
    if (typeof label === "string") {
        return label;
    }
    return label?.label || "";
}

export interface ProgressRecord {
    messages: string[]
    done: boolean;
}


export interface MessageRecord {
    choose(option: string): void;
    level: "info" | "warn" | "error",
    message: string,
    actions: string[],
    options?: MessageOptions
}

export interface TreeRecord {

}
