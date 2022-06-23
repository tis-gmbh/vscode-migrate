import { inject, injectable } from "inversify";
import { basename } from "path";
import { FileSystemProvider, Uri } from "vscode";
import { TYPES, VscCommands, VscWindow, VscWorkspace, VSC_TYPES } from "../di/types";
import { MatchManager } from "../migration/matchManger";
import { stringify, toFileUri } from "../utils/uri";
import { Command } from "./command";

@injectable()
export class NextChangeCommand implements Command {
    public readonly id: string = "vscode-migrate.next-change";

    public constructor(
        @inject(TYPES.ChangedContentProvider) protected readonly changedContentProvider: FileSystemProvider,
        @inject(VSC_TYPES.VscWindow) protected readonly window: VscWindow,
        @inject(VSC_TYPES.VscWorkspace) protected readonly workspace: VscWorkspace,
        @inject(TYPES.MatchManager) protected readonly matchManager: MatchManager,
        @inject(VSC_TYPES.VscCommands) protected readonly commands: VscCommands
    ) { }

    public async execute(matchUri: Uri): Promise<void> {
        await this.openNextAfter(matchUri);
    }

    private async openNextAfter(matchUri: Uri): Promise<void> {
        const nextMatch = this.getNextMatchAfter(matchUri);
        nextMatch ? await this.showChange(nextMatch) : 0;
    }

    private getNextMatchAfter(matchUri: Uri): Uri | undefined {
        return this.getNextInFile(matchUri)
            || this.getFirstInNextFile(matchUri);
    }

    private getNextInFile(matchUri: Uri): Uri | undefined {
        const fileUri = toFileUri(matchUri);
        const stringifiedUri = stringify(matchUri);
        const inFile = this.matchManager.getAllMatchUrisByFileUri(fileUri);
        const currentIndex = inFile.findIndex(candidate => stringify(candidate) === stringifiedUri);
        if (currentIndex === -1) {
            return undefined;
        }
        return inFile[currentIndex + 1];
    }

    private getFirstInNextFile(matchUri: Uri): Uri | undefined {
        const fileUri = stringify(toFileUri(matchUri));
        const files = this.matchManager.getQueuedFiles();
        const nextFileIndex = files.findIndex(candidate =>
            stringify(candidate) === fileUri
        ) + 1;
        const nextFile = files[nextFileIndex];

        if (!nextFile) {
            return undefined;
        }

        return this.matchManager.getMatchUrisByFileUri(nextFile)[0];
    }

    private showChange(matchUri: Uri): Thenable<void> {
        const fileUri = toFileUri(matchUri);
        const match = this.matchManager.byMatchUriOrThrow(matchUri);
        const title = basename(fileUri.fsPath) + ": " + match.match.label;
        return this.commands.executeCommand("vscode.diff", fileUri, matchUri, title);
    };
}
