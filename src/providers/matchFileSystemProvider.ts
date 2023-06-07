import { inject, injectable } from "inversify";
import { Disposable, Event, EventEmitter, FileChangeEvent, FileChangeType, FileStat, FileSystemProvider, FileType, RelativePattern, Uri } from "vscode";
import { TYPES, VscWorkspace, VSC_TYPES } from "../di/types";
import { MergeService } from "../mergeService";
import { MatchManager } from "../migration/matchManger";
import { stringify, toFileUri } from "../utils/uri";
import { NonEmptyArray } from "../utilTypes";

@injectable()
export class MatchFileSystemProvider implements FileSystemProvider {
    private readonly fileChangeEmitter = new EventEmitter<FileChangeEvent[]>();
    public readonly onDidChangeFile: Event<FileChangeEvent[]> = this.fileChangeEmitter.event;
    private readonly files: Record<string, Uint8Array> = {};
    private readonly lastModified: Record<string, number> = {};

    public constructor(
        @inject(VSC_TYPES.VscWorkspace) private readonly workspace: VscWorkspace,
        @inject(TYPES.MatchManager) private readonly matchManager: MatchManager,
        @inject(TYPES.MergeService) private readonly mergeService: MergeService
    ) { }

    public watch(uri: Uri): Disposable {
        const watcher = this.workspace.createFileSystemWatcher(new RelativePattern(toFileUri(uri), "*"));

        watcher.onDidChange(this.createEmitMapper(uri, FileChangeType.Changed));
        watcher.onDidDelete(this.createEmitMapper(uri, FileChangeType.Deleted));
        watcher.onDidCreate(this.createEmitMapper(uri, FileChangeType.Created));

        return watcher;
    }

    private createEmitMapper(matchUri: Uri, eventType: FileChangeType) {
        return (fileUri: Uri): void => {
            if (fileUri.scheme === "match") return;
            this.lastModified[stringify(fileUri)] = Date.now();
            this.fileChangeEmitter.fire([{
                type: eventType,
                uri: matchUri
            }]);
        };
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

    public readFile(uri: Uri): Promise<Uint8Array> {
        if (uri.scheme !== "match") throw new Error("Wrong scheme");
        return this.getContentFor(uri);
    }

    private async getContentFor(matchUri: Uri): Promise<Uint8Array> {
        try {
            return await this.tryGetContentFor(matchUri);
        } catch (error) {
            return Buffer.from(await this.getCurrentBase(matchUri));
        }
    }

    private async tryGetContentFor(matchUri: Uri): Promise<Uint8Array> {
        return Buffer.from(await this.getMergeResult(matchUri));
    }

    public async getMergeResult(...matches: NonEmptyArray<Uri>): Promise<string> {
        const firstMatch = matches[0];
        const originalBase = this.getOriginalBase(firstMatch);
        const currentBase = await this.getCurrentBase(firstMatch);

        const matchContentsPromises = matches.map(uri => this.getCurrentModified(uri));
        const matchContentsBuffers = await Promise.all(matchContentsPromises);
        const matchContents = matchContentsBuffers.map(buffer => buffer.toString());

        return this.mergeService.nWayMerge(originalBase, currentBase, ...matchContents);
    }

    private async getCurrentBase(matchUri: Uri): Promise<string> {
        const currentContentBuffer = await this.getCurrentOriginalContentFor(matchUri);
        return currentContentBuffer.toString();
    }

    public getOriginalBase(matchUri: Uri): string {
        const openedMatch = this.matchManager.byMatchUriOrThrow(matchUri);
        return openedMatch.originalContent.toString();
    }

    private getCurrentModified(matchUri: Uri): string {
        const openedMatch = this.matchManager.byMatchUriOrThrow(matchUri);
        const fileEntry = this.files[stringify(matchUri)];
        return fileEntry?.toString() || openedMatch.match.modifiedContent;
    }

    public getCurrentOriginalContentFor(matchUri: Uri): Thenable<Uint8Array> {
        const fileUri = toFileUri(matchUri);
        return this.workspace.fs.readFile(fileUri);
    }

    public writeFile(uri: Uri, content: Uint8Array, _options: { readonly create: boolean; readonly overwrite: boolean; }): void {
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
