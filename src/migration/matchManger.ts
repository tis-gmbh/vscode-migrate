import { inject, injectable } from "inversify";
import { } from "querystring";
import { EventEmitter, Uri } from "vscode";
import { TYPES, VSC_TYPES, VscWorkspace } from "../di/types";
import { Match, MatchedFile } from "../migrationTypes";
import { fsPathToFileUri, getMatchId, parse, stringify, toFileUri, toMatchUri } from "../utils/uri";
import { MigrationHolderRemote } from "./migrationHolderRemote";

export type MatchEntry = {
    match: Match;
    state: "resolved" | "queued";
    originalContent: Uint8Array;
};

const isResolved = (match: MatchEntry): boolean => match.state === "resolved";

@injectable()
export class MatchManager {
    private matches: Record<string, Array<MatchEntry>> = {};

    private readonly emitter = new EventEmitter<string[] | undefined>();
    public readonly onDidChange = this.emitter.event;
    private readonly stateEmitter = new EventEmitter<"updating" | "up to date">();
    public readonly onStateChange = this.stateEmitter.event;
    private readyPromise = Promise.resolve();

    public constructor(
        @inject(TYPES.MigrationHolderRemote) private readonly migrationHolder: MigrationHolderRemote,
        @inject(VSC_TYPES.VscWorkspace) private readonly workspace: VscWorkspace,
    ) {
        migrationHolder.migrationChanged(() => this.replaceMatches());
    }

    private getKeyByMatchUri(matchUri: Uri): string {
        return this.getKeyByFileUri(toFileUri(matchUri));
    }

    private getKeyByFileUri(fileUri: Uri): string {
        return stringify(fileUri);
    }

    private updateFileEntry(fileUri: Uri, newMatches: Array<MatchEntry>): void {
        const path = this.getKeyByFileUri(fileUri);

        const allMatchesResolved = newMatches.every(isResolved);
        const fileIsNew = this.matches[path] === undefined;

        this.matches[path] = newMatches;
        if (allMatchesResolved || fileIsNew) {
            this.notifyRootUpdate();
        } else {
            this.emitter.fire([path]);
        }
    }

    private notifyRootUpdate(): void {
        this.emitter.fire(undefined);
    }

    public getMatchIdByMatchUri(matchUri: Uri): number {
        return parseInt(getMatchId(matchUri));
    }

    public byMatchUriOrThrow(matchUri: Uri): MatchEntry {
        const path = this.getKeyByMatchUri(matchUri);
        const matchId = this.getMatchIdByMatchUri(matchUri);

        const matches = this.matches[path];

        const match = matches?.[matchId];
        if (!match) {
            throw new Error(`Unable to find match ${matchId} for file ${path}.`);
        }
        return match;
    }

    public getQueuedFiles(): Uri[] {
        return Object.entries(this.matches)
            .filter(([, matches]) => matches.some(match => match.state === "queued"))
            .map(([file]) => parse(file));
    }

    public getMatchUrisByFileUri(fileUri: Uri): Uri[] {
        const path = this.getKeyByFileUri(fileUri);
        return Object.entries(this.matches[path] || [])
            .filter(([_matchIndex, match]) => match.state === "queued")
            .map(([matchIndex],) => toMatchUri(fileUri, matchIndex));
    }

    public getMatchesByFileUri(fileUri: Uri): Match[] {
        const path = this.getKeyByFileUri(fileUri);
        return (this.matches[path] || [])
            .filter(matchEntry => matchEntry.state === "queued")
            .map(matchEntry => matchEntry.match);
    }

    public resolveEntry(matchUri: Uri): void {
        const path = this.getKeyByMatchUri(matchUri);
        const matchId = this.getMatchIdByMatchUri(matchUri);

        const fileMatches = this.matches[path] || [];
        const match = fileMatches[matchId];
        if (!match) {
            throw new Error(`Unable to find match ${matchId} for file ${path}.`);
        }
        match.state = "resolved";

        this.updateFileEntry(toFileUri(matchUri), fileMatches);
    }

    public resolveEntries(matchUris: Uri[]): void {
        const fileMatches = matchUris.reduce((acc, matchUri) => {
            const path = this.getKeyByMatchUri(matchUri);
            const matchId = this.getMatchIdByMatchUri(matchUri);

            const fileMatches = this.matches[path] || [];
            const match = fileMatches[matchId];
            if (!match) {
                throw new Error(`Unable to find match ${matchId} for file ${path}.`);
            }
            match.state = "resolved";

            acc[path] = fileMatches;
            return acc;
        }, {} as Record<string, Array<MatchEntry>>);

        Object.entries(fileMatches).forEach(([path, matches]) => {
            this.updateFileEntry(parse(path), matches);
        });
    }

    private replaceMatches(): Promise<void> {
        this.readyPromise = (async (): Promise<void> => {
            this.stateEmitter.fire("updating");
            let files: MatchedFile[] = [];
            if (await this.migrationHolder.hasMigration()) {
                files = await this.migrationHolder.getMatchedFiles();
            }
            await this.replaceFiles(files);
            this.stateEmitter.fire("up to date");
        })();
        return this.readyPromise;
    }

    private async replaceFiles(files: MatchedFile[]): Promise<void> {
        this.matches = {};
        for (const file of files) {
            const fileUri = fsPathToFileUri(file.path);
            const path = this.getKeyByFileUri(fileUri);
            const originalContent = await this.workspace.fs.readFile(fsPathToFileUri(file.path));
            this.matches[path] = file.matches.map(match => {
                return {
                    match,
                    state: "queued",
                    originalContent
                };
            });
        }
        this.emitter.fire(undefined);
    }

    public get ready(): Promise<void> {
        return this.readyPromise;
    }

    public get allResolved(): boolean {
        return Object.values(this.matches).every(matches => matches.every(isResolved));
    }
}
