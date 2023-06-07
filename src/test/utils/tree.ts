import { TreeDataProvider, TreeItem, Uri } from "vscode";
import { TYPES, VSC_TYPES } from "../../di/types";
import { MatchManager } from "../../migration/matchManger";
import { stringify } from "../../utils/uri";
import { CommandsStub } from "../stubs/commands";
import { TreeRecord, WindowStub } from "../stubs/window";

export function getAllMatchesTree(): Promise<Record<string, string[]> | Error> {
    const trees = getWindow().displayedTrees["vscode-migrate.all-matches"];
    return Promise.resolve(trees?.[trees.length - 1] || {});
}

export function getWellCoveredMatchesTree(): Promise<Record<string, string[]> | Error> {
    const trees = getWindow().displayedTrees["vscode-migrate.well-covered-matches"];
    return Promise.resolve(trees?.[trees.length - 1] || {});
}

export function getFirstMatch(): Uri {
    const file = getMatchManager().getQueuedFiles()[0];
    if (!file) throw new Error("No matches found");
    return getNthMatchUriOf(file, 1);
}

export function getNthMatchUriOf(fileUri: Uri, index: number): Uri {
    return getMatchManager().getMatchUrisByFileUri(fileUri)[index - 1]!;
}

export function clickTreeItem(item: TreeItem): any {
    const commandsStub = scenario.get<CommandsStub>(VSC_TYPES.VscCommands);
    return commandsStub.executeCommand(item.command!.command, ...item.command?.arguments || []);
}

function getWindow(): WindowStub {
    return scenario.get(VSC_TYPES.VscWindow);
}

function getMatchManager(): MatchManager {
    return scenario.get(TYPES.MatchManager);
}

async function getTreeItemsOf(treeElement: string): Promise<TreeItem[]> {
    const children = (await getTreeItemProvider().getChildren(treeElement)) || [];
    return Promise.all(children.map(c => getTreeItemProvider().getTreeItem(c)));
}

export function getTreeItemsOfUri(fileUri: Uri): Promise<TreeItem[]> {
    return getTreeItemsOf(stringify(fileUri));
}

function getTreeItemProvider(): TreeDataProvider<string> {
    return scenario.get(TYPES.AllMatchesTreeProvider);
}

export function allMatchesTree(criteria: Partial<TreeRecord>): Promise<TreeRecord> {
    return getWindow().displayedTrees["vscode-migrate.all-matches"]!.awaitEntryMatching(criteria);
}

export function wellCoveredMatchesTree(criteria: Partial<TreeRecord>): Promise<TreeRecord> {
    return getWindow().displayedTrees["vscode-migrate.well-covered-matches"]!.awaitEntryMatching(criteria);
}

export function allTreeUpdate(criteria: any[]): Promise<any[]> {
    return getWindow().treeUpdates["vscode-migrate.all-matches"]!.awaitEntryMatching(criteria);
}

export function wellCoveredTreeUpdate(criteria: any[]): Promise<any[]> {
    return getWindow().treeUpdates["vscode-migrate.well-covered-matches"]!.awaitEntryMatching(criteria);
}
