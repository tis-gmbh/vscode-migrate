import { inject, injectable } from "inversify";
import { basename } from "path";
import { ProviderResult, ThemeIcon, TreeDataProvider, TreeItem, TreeItemCollapsibleState, Uri } from "vscode";
import { TYPES } from "../di/types";
import { MatchManager } from "../migration/matchManger";
import { parse, stringify, toFileUri } from "../utils/uri";

function isMatchUri(uri: string): boolean {
    return Uri.parse(uri).query.length > 0;
}

@injectable()
export class QueuedMatchesProvider implements TreeDataProvider<string> {
    public readonly onDidChangeTreeData = this.matchManager.onDidChange;

    public constructor(
        @inject(TYPES.MatchManager) private readonly matchManager: MatchManager
    ) { }

    public getTreeItem(uri: string): TreeItem {
        const parsedUri = parse(uri);
        if (isMatchUri(uri)) {
            const match = this.matchManager.byMatchUriOrThrow(parsedUri);
            const item: TreeItem = {
                id: uri,
                label: `${match.match.label}`
            };
            const originalUri = toFileUri(parsedUri);
            const title = basename(originalUri.fsPath) + ": " + match.match.label;
            item.command = {
                command: "vscode.diff",
                title: "Show Change",
                arguments: [originalUri, parsedUri, title]
            };
            return item;
        }

        return {
            id: uri,
            label: basename(uri),
            collapsibleState: TreeItemCollapsibleState.Expanded,
            iconPath: ThemeIcon.File,
            resourceUri: Uri.parse(uri),
            tooltip: uri
        };
    }

    public getChildren(uri?: string): ProviderResult<string[]> {
        if (!uri) {
            return this.matchManager
                .getQueuedFiles()
                .map(uri => stringify(uri));
        }
        if (isMatchUri(uri)) {
            return [];
        }

        return this.matchManager
            .getMatchUrisByFileUri(parse(uri))
            .map(matchUri => stringify(matchUri));
    }
}

