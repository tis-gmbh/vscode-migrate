import { commands, extensions, tasks, window, workspace } from "vscode";

export const TYPES = {
    VscMigrate: Symbol.for("VSCMigrate"),
    MatchManager: Symbol.for("MatchManager"),
    MigrationHolder: Symbol.for("MigrationHolder"),
    MigrationLoader: Symbol.for("MigrationLoader"),
    MatchesTreeProvider: Symbol.for("ChangesTreeProvider"),
    ChangedContentProvider: Symbol.for("ChangedContentProvider"),
    Command: Symbol.for("Command"),
    CommandManager: Symbol.for("CommandManager"),
    VersionControl: Symbol.for("VersionControl"),
    GitExtension: Symbol.for("GitExtension"),
    CoverageDecorationProvider: Symbol.for("CoverageDecorationProvider"),
    TextDecorationConsumer: Symbol.for("CoverageDecorationConsumer"),
    MigrationOutputChannel: Symbol.for("MigrationOutputChannel")
};

export const VSC_TYPES = {
    VscCommands: Symbol.for("VscCommands"),
    VscWorkspace: Symbol.for("VscWorkspace"),
    VscWindow: Symbol.for("VscWindow"),
    VscExtensions: Symbol.for("VscExtensions"),
    VscTasks: Symbol.for("VscTasks")
};

export type VscCommands = typeof commands;
export type VscWorkspace = typeof workspace;
export type VscWindow = typeof window;
export type VscExtensions = typeof extensions;
export type VscTasks = typeof tasks;
