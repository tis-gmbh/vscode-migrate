import { readFileSync } from "fs";
import { copySync, emptyDirSync } from "fs-extra";
import { Container } from "inversify";
import { join, resolve } from "path";
import { commands, debug, DebugSession, DecorationInstanceRenderOptions, FileChangeType, FileSystemProvider, Location, MessageOptions, Position as SourcePosition, Range as VscRange, SourceBreakpoint, TextDocument, TreeDataProvider, TreeItem, TreeItemLabel, Uri, window } from "vscode";
import { ApplyChangeCommand } from "../../command/applyChangeCommand";
import { Command } from "../../command/command";
import { DebugMigrationScriptProcessCommand } from "../../command/debugMigrationScriptProcesCommand";
import { modules, vscCommands, vscModules } from "../../di/inversify.config";
import { TYPES } from "../../di/types";
import { MatchManager } from "../../migration/matchManger";
import { MigrationHolderRemote } from "../../migration/migrationHolderRemote";
import { MigrationLoaderRemote } from "../../migration/migrationLoaderRemote";
import { MigrationOutputChannel } from "../../migration/migrationOutputChannel";
import { MigrationStdOutChannel } from "../../migration/migrationStdOutChannel";
import { fsPathToFileUri, stringify, toFileUri } from "../../utils/uri";
import { API, Change, Repository, Status } from "../../vcs/git";
import { GitExtension } from "../../vcs/gitExtension";
import { VSCodeMigrate } from "../../vscodeMigrate";


const fixturePath = resolve(__dirname, "../../../src/test/fixtures/");
const testWorkspacePath = join(fixturePath, "_testWorkspace");
const migrationsPath = join(fixturePath, "migrations");

type FileReader = (...path: string[]) => string;

interface Position {
    line: number;
    character: number;
}

interface Range {
    start: Position;
    end: Position;
}

export interface Decoration {
    range: Range
    options?: DecorationInstanceRenderOptions;
}


export class Scenario {
    public readonly original = fileReaderFor(this.originalPath());
    public readonly actual = fileReaderFor(this.actualPath());
    public readonly expected = fileReaderFor(this.expectationPath());
    private readonly logs: string[] = [];

    public readonly container: Container;
    public readonly vsCodeMigrate: VSCodeMigrate;
    private readonly matchManager: MatchManager;
    private readonly treeProvider: TreeDataProvider<string>;
    private readonly contentProvider: FileSystemProvider;
    public readonly treeUpdates: Array<any[]> = [];
    public readonly contentUpdates: Array<any[]> = [];
    public readonly notifications: Array<{
        level: "info" | "warn" | "error",
        message: string,
        actions: string[],
        options?: MessageOptions
    }> = [];
    public readonly executedCommands: Array<{
        command: string,
        args: any[],
        result: any
    }> = [];
    public readonly stagedPaths: string[][] = [];
    public readonly commitMessages: string[] = [];
    private readonly workingTreeChanges: Change[] = [];
    // eslint-disable-next-line @typescript-eslint/prefer-readonly
    private workingTreeScanned = false;

    private constructor(public name: string) {
        emptyDirSync(testWorkspacePath);
        copySync(this.originalPath(), testWorkspacePath, { recursive: true });
        copySync(migrationsPath, join(testWorkspacePath, ".vscode/migrations"));

        this.container = new Container();
        this.container.load(modules, vscModules, vscCommands);
        this.prepareDependencies();
        this.vsCodeMigrate = this.container.get(TYPES.VscMigrate);
        this.matchManager = this.vsCodeMigrate.matchManager;
        this.treeProvider = this.vsCodeMigrate.queuedChangesProvider;
        this.contentProvider = this.vsCodeMigrate.matchReplacementProvider;

        if (this.treeProvider.onDidChangeTreeData) {
            this.treeProvider.onDidChangeTreeData((...args) => this.treeUpdates.push(args));
        }

        if (this.contentProvider.onDidChangeFile) {
            this.contentProvider.onDidChangeFile((...args) => this.contentUpdates.push(args));
        }

        debug.removeBreakpoints(debug.breakpoints);
    }

    public static async load(name: string, migrationName?: string): Promise<Scenario> {
        const scenario = new Scenario(name);
        if (migrationName) {
            await scenario.startMigration(migrationName);
        }
        return scenario;
    }

    public async startMigration(migrationName: string): Promise<void> {
        const migrationLoader = this.container.get<MigrationLoaderRemote>(TYPES.MigrationLoaderRemote);
        const migrationHolder = this.container.get<MigrationHolderRemote>(TYPES.MigrationHolderRemote);
        await migrationLoader.refresh();
        const migrations = await migrationLoader.getNames();
        const defaultMigration = migrations.find(migration => migration === migrationName);
        if (!defaultMigration) throw new Error("Default migration not found");

        await migrationHolder.start(defaultMigration);
        await this.matchManager.ready;
    }

    private prepareDependencies(): void {
        this.createMessageLogger("showInformationMessage");
        this.createMessageLogger("showErrorMessage");
        this.createMessageLogger("showWarningMessage");
        this.createCommandsLogger();
        this.createOutputLogger();
        this.rebindGitExtension();
    }

    private createMessageLogger<N extends "showInformationMessage" | "showErrorMessage" | "showWarningMessage">(original: N): void {
        const originalImplementation = window[original];
        window[original] = (message: string, options: string | MessageOptions, ...restOptions: string[]): Thenable<any> => {
            this.notifications.push({
                level: original === "showInformationMessage" ? "info" :
                    original === "showErrorMessage" ? "error" : "warn",
                message,
                actions: typeof options === "string" ? [options, ...restOptions] : [],
                options: typeof options === "string" ? undefined : options
            });
            return originalImplementation(message, options as any, ...restOptions);
        };
    }

    private createCommandsLogger(): void {
        const originalImplementation = commands["executeCommand"];
        commands["executeCommand"] = async (command: string, ...args: any[]): Promise<any> => {
            const result = await originalImplementation(command, ...args);
            this.executedCommands.push({
                command: command,
                args,
                result
            });
            return result;
        };
    }

    private createOutputLogger(): void {
        const scenario = this;
        this.container.rebind(TYPES.MigrationOutputChannel).to(class extends MigrationOutputChannel {
            public append(value: string): void {
                scenario.logs.push("MigrationOutputChannel: " + value);
                super.append(value);
            }
        }).inSingletonScope();

        this.container.rebind(TYPES.MigrationStdOutChannel).to(class extends MigrationStdOutChannel {
            public append(value: string): void {
                scenario.logs.push("MigrationStdOutChannel: " + value);
                super.append(value);
            }
        }).inSingletonScope();
    }

    private rebindGitExtension(): void {
        const scenario = this;
        this.container.rebind(TYPES.GitExtension).to(class extends GitExtension {
            public getGitApi(): Promise<API> {
                return Promise.resolve({
                    getRepository: () => {
                        return {
                            add: (paths: string[]) => {
                                scenario.stagedPaths.push(paths);
                            },
                            commit: (message: string) => {
                                scenario.commitMessages.push(message);
                            },
                            state: {
                                get workingTreeChanges() {
                                    return scenario.workingTreeScanned ? scenario.workingTreeChanges : [];
                                }
                            },
                            status: () => {
                                scenario.workingTreeScanned = true;
                                return Promise.resolve();
                            }
                        } as Partial<Repository> as Repository;
                    }
                } as Partial<API> as API);
            }
        });
    }

    public setModified(fileUri: Uri): void {
        this.workingTreeChanges.push({
            originalUri: fileUri,
            renameUri: fileUri,
            uri: fileUri,
            status: Status.MODIFIED
        });
    }

    public setUntracked(fileUri: Uri): void {
        this.workingTreeChanges.push({
            originalUri: fileUri,
            renameUri: fileUri,
            uri: fileUri,
            status: Status.UNTRACKED
        });
    }

    public scenarioPath(...path: string[]): string {
        return join(fixturePath, `${this.name}Project`, ...path);
    }

    public originalPath(...path: string[]): string {
        return this.scenarioPath("originals", ...path);
    }

    public expectationPath(...path: string[]): string {
        return this.scenarioPath("expectations", ...path);
    }

    public actualPath(...path: string[]): string {
        return join(testWorkspacePath, ...path);
    }

    public actualUri(...path: string[]): Uri {
        return fsPathToFileUri(this.actualPath(...path));
    }

    public getFirstMatch(): Uri {
        const file = this.matchManager.getQueuedFiles()[0];
        if (!file) throw new Error("No matches found");
        return this.getNthMatchUriOf(file, 1);
    }

    public getNthMatchUriOf(fileUri: Uri, index: number): Uri {
        return this.matchManager.getMatchUrisByFileUri(fileUri)[index - 1]!;
    }

    public async getDisplayedTree(): Promise<Record<string, string[]>> {
        const children = await this.treeProvider.getChildren();
        if (!children) return {};

        const tree: Record<string, string[]> = {};
        for (const element of children) {
            const item = await this.treeProvider.getTreeItem(element);
            const childLabels = await this.getChildLabelsOf(element);

            tree[stringifyLabel(item.label)] = childLabels;
        }

        return tree;
    }

    public async getChildLabelsOf(treeElement: string): Promise<string[]> {
        return (await this.getTreeItemsOf(treeElement))
            .map(i => stringifyLabel(i.label));
    }

    public async getTreeItemsOf(treeElement: string): Promise<TreeItem[]> {
        const children = (await this.treeProvider.getChildren(treeElement)) || [];
        return Promise.all(children.map(c => this.treeProvider.getTreeItem(c)));
    }

    public async getTreeItemsOfUri(fileUri: Uri): Promise<TreeItem[]> {
        return this.getTreeItemsOf(stringify(fileUri));
    }

    public async applyChangesFor(matchUri: Uri): Promise<void> {
        const applyChangeCommand = this.getCommand<ApplyChangeCommand>("vscode-migrate.apply-change");
        this.setModified(toFileUri(matchUri));
        await applyChangeCommand.execute(matchUri);
    }

    public getCommand<T extends Command>(id: string): T {
        return this.container
            .getAll<T>(TYPES.Command)
            .find(command => command.id === id)!;
    }

    public async applyAllFor(fileUri: Uri): Promise<void> {
        let currentMatches = this.matchManager.getMatchUrisByFileUri(fileUri);
        this.log(`Applying all ${currentMatches.length} changes for ${fileUri.fsPath}`);
        while (true) {
            const nextMatch = currentMatches[0];
            if (!nextMatch) break;
            await this.applyChangesFor(nextMatch);
            const newMatches = this.matchManager.getMatchUrisByFileUri(fileUri);
            if (currentMatches.length <= newMatches.length) throw new Error(`Stuck at applying ${newMatches.length} matches.`);
            currentMatches = newMatches;
        }
        this.log(`Applied all ${currentMatches.length} changes for ${fileUri.fsPath}`);
    }

    public async getChangedContentFor(matchUri: Uri): Promise<string> {
        const buffer = await this.contentProvider.readFile(matchUri);
        this.contentProvider.watch(matchUri, { recursive: false, excludes: [] });
        return buffer.toString();
    }

    public async updateOf(matchUri: Uri): Promise<void> {
        const stringifiedUri = stringify(matchUri);

        return new Promise(res => {
            this.contentProvider.onDidChangeFile(updatedFiles => {
                if (updatedFiles.find(file =>
                    stringify(file.uri) === stringifiedUri
                    && file.type === FileChangeType.Changed
                )) {
                    this.log(`File ${stringifiedUri} received an update.`);
                    res();
                }
            });
        });
    }

    public async modifyContent(matchUri: Uri, callback: (originalContent: string) => string): Promise<void> {
        this.log(`Modifying content of ${matchUri}`);
        const originalBuffer = await this.contentProvider.readFile(matchUri);
        this.contentProvider.watch(matchUri, { recursive: false, excludes: [] });
        const originalContent = originalBuffer.toString();
        const newContent = callback(originalContent);
        const buffer = Buffer.from(newContent);
        await this.contentProvider.writeFile(matchUri, buffer, { create: false, overwrite: true });
        this.log(`Modified content of ${matchUri}`);
    }

    public async getDecorationsFor(fileUri: Uri): Promise<Decoration[]> {
        const originalDecorations = await this.vsCodeMigrate.coverageDecorationProvider.getDecorationsFor({
            lineCount: 12,
            uri: fileUri
        } as Partial<TextDocument> as TextDocument);
        return originalDecorations.map(decoration => {
            return {
                range: transformRange(decoration.range),
                options: decoration.renderOptions
            };
        });
    }

    public addBreakpoint(fileUri: Uri, position: SourcePosition): Promise<void> {
        this.log(`Adding breakpoint at ${fileUri.fsPath}:${position.line}`);
        return new Promise(res => {
            const disposable = debug.onDidChangeBreakpoints(() => {
                disposable.dispose();
                this.log(`Breakpoint added at ${fileUri.fsPath}:${position.line}`);
                res();
            });
            debug.addBreakpoints([new SourceBreakpoint(new Location(fileUri, position))]);
        });
    }

    public async startDebugging(): Promise<void> {
        this.log("Starting debugging...");
        const debugCommand = this.getCommand<DebugMigrationScriptProcessCommand>("vscode-migrate.debug-migration-script-process");
        await debugCommand.execute();
        this.log("Debugging started.");
    }

    public async waitForBreakpointHit(): Promise<SourceBreakpoint> {
        const scenario = this;
        return new Promise(res => {
            debug.registerDebugAdapterTrackerFactory("pwa-node", {
                createDebugAdapterTracker(session: DebugSession) {
                    return {
                        async onDidSendMessage(message: any): Promise<void> {
                            if (message.type === "event"
                                && message.event === "stopped"
                                && message.body.reason === "breakpoint") {
                                const breakpointId = message.body.hitBreakpointIds[0];
                                const mappedBreakpoints = await Promise.all(debug.breakpoints.map(async breakpoint =>
                                    session.getDebugProtocolBreakpoint(breakpoint)
                                ));
                                const breakpointIndex = mappedBreakpoints.findIndex(breakpoint =>
                                    (breakpoint as any)?.id === breakpointId
                                );
                                const hitBreakpoint = debug.breakpoints[breakpointIndex] as SourceBreakpoint;
                                scenario.log("Hit breakpoint at " + stringify(hitBreakpoint.location.uri) + ":" + hitBreakpoint.location.range.start.line);
                                res(hitBreakpoint);
                            }
                        }
                    };
                }
            });
        });
    }

    private log(message: string): void {
        this.logs.push("Scenario: " + message);
    }

    public dumpLogs(): void {
        for (const log of this.logs) {
            console.log(log);
        }
    }
}

function fileReaderFor(basePath: string): FileReader {
    return (...paths) => readFileSync(join(basePath, ...paths), { encoding: "utf-8" });
}

function stringifyLabel(label: string | TreeItemLabel | undefined): string {
    if (typeof label === "string") {
        return label;
    }
    return label?.label || "";
}

function transformRange(range: VscRange): Range {
    return {
        start: {
            line: range.start.line,
            character: range.start.character
        },
        end: {
            line: range.end.line,
            character: range.end.character
        }
    };
}

export function createCoverageScheme(executions: Array<number | null>): Decoration[] {
    return executions.map((hits, lineNumber) => {
        return {
            range: getDecorationRangeForLine(lineNumber),
            options: getOptionsForHits(hits)
        };
    });
}

function getOptionsForHits(hits: number | null = null): DecorationInstanceRenderOptions {
    const options: DecorationInstanceRenderOptions = {
        before: {
            contentText: getHitText(hits),
            width: "5ch"
        }
    };
    const color = getHitColor(hits);
    if (color) {
        options.before!.color = color;
    }
    return options;
}

function getDecorationRangeForLine(l: number): Range {
    return {
        start: {
            line: l,
            character: 0,
        },
        end: {
            line: l + 1,
            character: 0
        }
    };
}

function getHitText(hits: number | null): string {
    if (hits === null) {
        return "     ";
    }
    return `${hits}x`.padStart(5, " ");
}

function getHitColor(hits: number | null): string | undefined {
    if (hits === null) {
        return undefined;
    }
    if (hits > 0) {
        return "lime";
    }
    return "red";
}
