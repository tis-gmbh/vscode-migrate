import { inject, injectable } from "inversify";
import { EventEmitter, Uri } from "vscode";
import { TYPES } from "../di/types";
import { MergeService } from "../mergeService";
import { MatchEntry, MatchManager } from "../migration/matchManger";
import { MatchCollection } from "../test/utils/matchCollection";
import { asyncFilter, asyncSome } from "../utils/asyncArray";
import { toFileUri } from "../utils/uri";
import { CoverageProvider } from "./coverageProvider";
import { MatchFileSystemProvider } from "./matchFileSystemProvider";
import { MatchSource } from "./matchTreeProvider";

@injectable()
export class MatchCoverageFilter implements MatchSource {
    private readonly _onDidChangeTreeData = new EventEmitter<string[] | undefined>();
    public readonly onDidChange = this._onDidChangeTreeData.event;

    public constructor(
        @inject(TYPES.MatchManager) private readonly matchManager: MatchManager,
        @inject(TYPES.CoverageProvider) private readonly coverageProvider: CoverageProvider,
        @inject(TYPES.MatchFileSystemProvider) private readonly matchFSProvider: MatchFileSystemProvider,
        @inject(TYPES.MergeService) private readonly mergeService: MergeService
    ) {
        this.matchManager.onDidChange(this.triggerUpdate, this);
        this.coverageProvider.onCoverageChanged(this.triggerUpdate, this);
    }

    public getMatchUrisByFileUri(uri: Uri): Promise<Uri[]> {
        return asyncFilter(
            this.matchManager.getMatchUrisByFileUri(uri),
            match => this.isWellCovered(match)
        );
    }

    public getQueuedFiles(): Promise<Uri[]> {
        const queuedFiles = this.matchManager.getQueuedFiles();
        return asyncFilter(queuedFiles, file => this.doesFileHaveWellCoveredMatches(file));
    }

    private async doesFileHaveWellCoveredMatches(file: Uri): Promise<boolean> {
        const matches = await this.getMatchUrisByFileUri(file);
        return asyncSome(matches, match => this.isWellCovered(match));
    }

    private triggerUpdate(updates: string[] | undefined): void {
        this._onDidChangeTreeData.fire(updates);
    }

    public byMatchUriOrThrow(uri: Uri): MatchEntry {
        return this.matchManager.byMatchUriOrThrow(uri);
    }

    private async isWellCovered(match: Uri): Promise<boolean> {
        const changedContent = (await this.matchFSProvider.readFile(match)).toString();
        const currentOriginalBuffer = await this.matchFSProvider.getCurrentOriginalContentFor(match);
        const currentOriginalContent = currentOriginalBuffer.toString();

        const changedSections = this.mergeService.getDiffSections(currentOriginalContent, changedContent);

        const fileUri = toFileUri(match);
        return changedSections.every(section => this.coverageProvider.isWellCovered(fileUri, section.startLine, section.endLine));
    }

    public async getAll(): Promise<MatchCollection> {
        const filesWithCoveredMatches = await this.getQueuedFiles();
        const matches = new MatchCollection();

        for (const file of filesWithCoveredMatches) {
            const matchUris = await this.getMatchUrisByFileUri(file);
            matches.push(...matchUris);
        }

        return matches;
    }
}
