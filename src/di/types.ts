import { commands, debug, extensions, window, workspace } from "vscode";

export const TYPES = {
    VscMigrate: Symbol.for("VSCMigrate"),
    MatchManager: Symbol.for("MatchManager"),
    MigrationHolderRemote: Symbol.for("MigrationHolderRemote"),
    MigrationLoaderRemote: Symbol.for("MigrationLoaderRemote"),
    MatchesTreeProvider: Symbol.for("ChangesTreeProvider"),
    ChangedContentProvider: Symbol.for("ChangedContentProvider"),
    Command: Symbol.for("Command"),
    CommandManager: Symbol.for("CommandManager"),
    VersionControl: Symbol.for("VersionControl"),
    GitExtension: Symbol.for("GitExtension"),
    CoverageDecorationProvider: Symbol.for("CoverageDecorationProvider"),
    TextDecorationConsumer: Symbol.for("CoverageDecorationConsumer"),
    MigrationOutputChannel: Symbol.for("MigrationOutputChannel"),
    MigrationScriptProcessController: Symbol.for("MigrationScriptProcessController"),
    MigrationStdOutChannel: Symbol.for("MigrationStdOutChannel")
};

export const VSC_TYPES = {
    VscCommands: Symbol.for("VscCommands"),
    VscWorkspace: Symbol.for("VscWorkspace"),
    VscWindow: Symbol.for("VscWindow"),
    VscExtensions: Symbol.for("VscExtensions"),
    VscTasks: Symbol.for("VscTasks"),
    VscDebug: Symbol.for("VscDebug")
};

export interface VscDebug extends Partial<typeof debug> {
    startDebugging: typeof debug.startDebugging;
}

export interface VscWorkspace extends Partial<typeof workspace> {
    registerFileSystemProvider: typeof workspace.registerFileSystemProvider;
    asRelativePath: typeof workspace.asRelativePath;
    fs: typeof workspace.fs;
    createFileSystemWatcher: typeof workspace.createFileSystemWatcher;
    textDocuments: typeof workspace.textDocuments;
    findFiles: typeof workspace.findFiles;
    workspaceFolders: typeof workspace.workspaceFolders;
}

export interface VscExtensions extends Partial<typeof extensions> {
    getExtension: typeof extensions.getExtension;
}

export interface VscWindow extends Partial<typeof window> {
    showInformationMessage: typeof window.showInformationMessage;
    showErrorMessage: typeof window.showErrorMessage;
    showWarningMessage: typeof window.showWarningMessage;
    registerTreeDataProvider: typeof window.registerTreeDataProvider;
    visibleTextEditors: typeof window.visibleTextEditors;
    onDidChangeVisibleTextEditors: typeof window.onDidChangeVisibleTextEditors;
    createTextEditorDecorationType: typeof window.createTextEditorDecorationType;
    createOutputChannel: typeof window.createOutputChannel;
    withProgress: typeof window.withProgress;
    showQuickPick: typeof window.showQuickPick;
}

export interface VscCommands extends Partial<typeof commands> {
    executeCommand: typeof commands.executeCommand;
    registerCommand: typeof commands.registerCommand;
}
