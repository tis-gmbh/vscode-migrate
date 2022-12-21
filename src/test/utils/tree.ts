import { TreeItem, TreeItemLabel, Uri } from "vscode";
import { TYPES, VSC_TYPES } from "../../di/types";
import { MatchManager } from "../../migration/matchManger";
import { QueuedMatchesProvider } from "../../providers/queuedMatchesProvider";
import { stringify } from "../../utils/uri";
import { CommandsStub } from "../stubs/commands";

export async function getDisplayedTree(): Promise<Record<string, string[]>> {
    const children = await getTreeProvider().getChildren();
    if (!children) return {};

    const tree: Record<string, string[]> = {};
    for (const element of children) {
        const item = getTreeProvider().getTreeItem(element);
        const childLabels = await getChildLabelsOf(element);

        tree[stringifyLabel(item.label)] = childLabels;
    }

    return tree;
}

export async function getChildLabelsOf(treeElement: string): Promise<string[]> {
    return (await getTreeItemsOf(treeElement))
        .map(i => stringifyLabel(i.label));
}

export async function getTreeItemsOf(treeElement: string): Promise<TreeItem[]> {
    const children = (await getTreeProvider().getChildren(treeElement)) || [];
    return Promise.all(children.map(c => getTreeProvider().getTreeItem(c)));
}

export async function getTreeItemsOfUri(fileUri: Uri): Promise<TreeItem[]> {
    return getTreeItemsOf(stringify(fileUri));
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

function getTreeProvider(): QueuedMatchesProvider {
    return scenario.get(TYPES.MatchesTreeProvider);
}

function getMatchManager(): MatchManager {
    return scenario.get(TYPES.MatchManager);
}

function stringifyLabel(label: string | TreeItemLabel | undefined): string {
    if (typeof label === "string") {
        return label;
    }
    return label?.label || "";
}
