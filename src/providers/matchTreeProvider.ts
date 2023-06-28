import { injectable } from "inversify";
import { basename } from "path";
import { Event, ThemeIcon, TreeDataProvider, TreeItem, TreeItemCollapsibleState, Uri } from "vscode";
import { MatchEntry } from "../migration/matchManger";
import { MatchCollection } from "../test/utils/matchCollection";
import { parse, stringify, toFileUri } from "../utils/uri";

function isMatchUri(uri: string): boolean {
    return Uri.parse(uri).query.length > 0;
}

@injectable()
export abstract class MatchTreeProvider implements TreeDataProvider<string> {
    public readonly onDidChangeTreeData = this.matchSource.onDidChange;

    public constructor(
        private readonly matchSource: MatchSource
    ) { }

    public getTreeItem(uri: string): TreeItem {
        const parsedUri = parse(uri);
        if (isMatchUri(uri)) {
            const match = this.matchSource.byMatchUriOrThrow(parsedUri);
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

    public async getChildren(uri?: string | undefined): Promise<string[]> {
        if (!uri) {
            return this.getQueuedFiles();
        }
        if (isMatchUri(uri)) {
            return [];
        }

        return (await this.matchSource
            .getMatchUrisByFileUri(parse(uri)))
            .map(matchUri => stringify(matchUri));
    }

    protected async getQueuedFiles(): Promise<string[]> {
        return (await this.matchSource.getQueuedFiles())
            .map(uri => stringify(uri));
    }
}

export interface MatchSource {
    onDidChange: Event<string[] | undefined>;
    byMatchUriOrThrow(uri: Uri): MatchEntry;
    getMatchUrisByFileUri(uri: Uri): Promise<Uri[]> | Uri[];
    getQueuedFiles(): Promise<Uri[]> | Uri[];
}
