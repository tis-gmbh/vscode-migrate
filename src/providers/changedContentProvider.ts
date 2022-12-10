import { Merge, StringEngine } from "@asmartbear/diff-merge/dist";
import { inject, injectable } from "inversify";
import { Disposable, Event, EventEmitter, FileChangeEvent, FileChangeType, FileStat, FileSystemProvider, FileType, RelativePattern, Uri } from "vscode";
import { TYPES, VscWindow, VscWorkspace, VSC_TYPES } from "../di/types";
import { MatchManager } from "../migration/matchManger";
import { MigrationHolderRemote } from "../migration/migrationHolderRemote";
import { stringify, toFileUri } from "../utils/uri";

@injectable()
export class ChangedContentProvider implements FileSystemProvider {
    private readonly fileChangeEmitter = new EventEmitter<FileChangeEvent[]>();
    public readonly onDidChangeFile: Event<FileChangeEvent[]> = this.fileChangeEmitter.event;
    private readonly files: Record<string, Uint8Array> = {};
    private readonly lastModified: Record<string, number> = {};

    public constructor(
        @inject(VSC_TYPES.VscWindow) private readonly window: VscWindow,
        @inject(VSC_TYPES.VscWorkspace) private readonly workspace: VscWorkspace,
        @inject(TYPES.MatchManager) private readonly matchManager: MatchManager,
        @inject(TYPES.MigrationHolderRemote) private readonly migrationHolder: MigrationHolderRemote
    ) { }

    public watch(uri: Uri, _options: { readonly recursive: boolean; readonly excludes: readonly string[] }): Disposable {
        const fileUri = toFileUri(uri);
        const watcher = this.workspace.createFileSystemWatcher(new RelativePattern(fileUri, "*"));

        watcher.onDidChange((e) => {
            if (e.scheme === "match") return;
            this.lastModified[stringify(uri)] = Date.now();
            this.fileChangeEmitter.fire([{
                type: FileChangeType.Changed,
                uri
            }]);
        });
        watcher.onDidDelete((e) => {
            if (e.scheme === "match") return;
            this.lastModified[stringify(uri)] = Date.now();
            this.fileChangeEmitter.fire([{
                type: FileChangeType.Deleted,
                uri
            }]);
        });
        watcher.onDidCreate((e) => {
            if (e.scheme === "match") return;
            this.lastModified[stringify(uri)] = Date.now();
            this.fileChangeEmitter.fire([{
                type: FileChangeType.Created,
                uri
            }]);
        });
        return watcher;
    }

    public stat(uri: Uri): FileStat | Thenable<FileStat> {
        return {
            ctime: 0,
            mtime: this.lastModified[stringify(uri)] || Date.now(),
            size: 0,
            type: FileType.File
        };
    }

    public readDirectory(_uri: Uri): [string, FileType][] | Thenable<[string, FileType][]> {
        throw new Error("Method not implemented.");
    }

    public createDirectory(_uri: Uri): void | Thenable<void> {
        throw new Error("Method not implemented.");
    }

    public async readFile(uri: Uri): Promise<Uint8Array> {
        if (uri.scheme !== "match") throw new Error("Wrong scheme");
        return this.getMergedContent(uri);
    }

    private async getMergedContent(matchUri: Uri): Promise<Uint8Array> {
        const currentContentBuffer = await this.getCurrentOriginalContentFor(matchUri);
        const currentContent = currentContentBuffer.toString();

        const fileEntry = this.files[stringify(matchUri)];

        try {
            const openedMatch = this.matchManager.byMatchUriOrThrow(matchUri);
            const modifiedContent = fileEntry?.toString() || openedMatch.match.modifiedContent;
            const originalContent = openedMatch.originalContent.toString();

            const eng = new StringEngine();
            const originalToCurrent = eng.getEditsByCharacter(originalContent, currentContent);
            const originalToModified = eng.getEditsByCharacter(originalContent, modifiedContent);

            const merge = new Merge<string>();
            const result = merge.merge3(originalToModified, originalToCurrent);
            const mergeResult = result.join("");

            return Buffer.from(mergeResult);
        } catch (error) {
            return currentContentBuffer;
        }
    }

    private getCurrentOriginalContentFor(matchUri: Uri): Thenable<Uint8Array> {
        const fileUri = toFileUri(matchUri);
        return this.workspace.fs.readFile(fileUri);
    }

    public async writeFile(uri: Uri, content: Uint8Array, _options: { readonly create: boolean; readonly overwrite: boolean; }): Promise<void> {
        const path = stringify(uri);
        this.files[path] = content;
    }

    public delete(_uri: Uri, _options: { readonly recursive: boolean; }): void | Thenable<void> {
        throw new Error("Method not implemented.");
    }

    public rename(_oldUri: Uri, _newUri: Uri, _options: { readonly overwrite: boolean; }): void | Thenable<void> {
        throw new Error("Method not implemented.");
    }
};
