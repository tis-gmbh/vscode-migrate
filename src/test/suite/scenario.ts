import { readFileSync } from "fs";
import { copySync, emptyDirSync } from "fs-extra";
import { Container } from "inversify";
import { join, resolve } from "path";
import { commands, DecorationInstanceRenderOptions, FileChangeType, FileSystemProvider, MessageOptions, Range as VscRange, TextDocument, TreeDataProvider, TreeItem, TreeItemLabel, Uri, window } from "vscode";
import { ApplyChangeCommand } from "../../command/applyChangeCommand";
import { Command } from "../../command/command";
import { modules, vscCommands, vscModules } from "../../di/inversify.config";
import { TYPES } from "../../di/types";
import { MatchManager } from "../../migration/matchManger";
import { MigrationHolder } from "../../migration/migrationHolder";
import { MigrationLoader } from "../../migration/migrationLoader";
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

    private readonly container: Container;
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
    }

    public static async load(name: string, migrationName: string): Promise<Scenario> {
        const scenario = new Scenario(name);
        await scenario.startMigration(migrationName);
        return scenario;
    }

    private async startMigration(migrationName: string): Promise<void> {
        const migrationLoader = this.container.get<MigrationLoader>(TYPES.MigrationLoader);
        const migrationHolder = this.container.get<MigrationHolder>(TYPES.MigrationHolder);
        await migrationLoader.refresh();
        const migrations = migrationLoader.getNames();
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
        const children = await this.treeProvider.getChildren(treeElement) || [];
        return Promise.all(children.map(c => this.treeProvider.getTreeItem(c)));
    }

    public async getTreeItemsOfUri(fileUri: Uri): Promise<TreeItem[]> {
        return this.getTreeItemsOf(stringify(fileUri));
    }

    public async applyChangesFor(matchUri: Uri): Promise<void> {
        const applyChangeCommand = this.getCommand<ApplyChangeCommand>("vscode-migrate.apply-change");
        this.setModified(toFileUri(matchUri));
        await applyChangeCommand?.execute(matchUri);
    }

    public getCommand<T extends Command>(id: string): T | undefined {
        return this.container
            .getAll<T>(TYPES.Command)
            .find(command => command.id === id);
    }

    public async applyAllFor(fileUri: Uri): Promise<void> {
        let currentMatches = this.matchManager.getMatchUrisByFileUri(fileUri);
        while (true) {
            const nextMatch = currentMatches[0];
            if (!nextMatch) break;
            await this.applyChangesFor(nextMatch);
            const newMatches = this.matchManager.getMatchUrisByFileUri(fileUri);
            if (currentMatches.length <= newMatches.length) throw new Error(`Stuck at applying ${newMatches.length} matches.`);
            currentMatches = newMatches;
        }
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
                    res();
                }
            });
        });
    }

    public async modifyContent(matchUri: Uri, callback: (originalContent: string) => string): Promise<void> {
        const originalBuffer = await this.contentProvider.readFile(matchUri);
        this.contentProvider.watch(matchUri, { recursive: false, excludes: [] });
        const originalContent = originalBuffer.toString();
        const newContent = callback(originalContent);
        const buffer = Buffer.from(newContent);
        await this.contentProvider.writeFile(matchUri, buffer, { create: false, overwrite: true });
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
