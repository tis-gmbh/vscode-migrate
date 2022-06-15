import { inject, injectable } from "inversify";
import { basename } from "path";
import { Uri } from "vscode";
import { TYPES } from "../di/types";
import { MatchManager } from "../migration/matchManger";
import { MigrationHolder } from "../migration/migrationHolder";
import { toFileUri } from "../utils/uri";
import { API, Repository } from "./git";
import { GitExtension } from "./gitExtension";

@injectable()
export class VersionControl {
    private gitApi!: API;

    public constructor(
        @inject(TYPES.MatchManager) private readonly matchManager: MatchManager,
        @inject(TYPES.MigrationHolder) private readonly migrationHolder: MigrationHolder,
        @inject(TYPES.GitExtension) private readonly gitExtension: GitExtension
    ) { }

    public async stageAndCommit(matchUri: Uri): Promise<void> {
        this.gitApi = await this.gitExtension.getGitApi();
        await this.stage(matchUri);
        await this.commit(matchUri);
    }

    private async stage(matchUri: Uri): Promise<void> {
        const fileUri = toFileUri(matchUri);
        const repo = this.getRepoOrThrow(fileUri);
        await repo.add([fileUri.fsPath]);
    }

    private getRepoOrThrow(fileUri: Uri): Repository {
        const repo = this.gitApi.getRepository(fileUri);
        if (!repo) throw new Error("Modified file is not in a repo.");
        return repo;
    }

    private async commit(matchUri: Uri): Promise<void> {
        const fileUri = toFileUri(matchUri);
        const commitMessage = this.getCommitMessageFor(matchUri);
        const repo = this.getRepoOrThrow(fileUri);
        await repo.commit(commitMessage, { noVerify: true });
    }

    private getCommitMessageFor(matchUri: Uri): string {
        const match = this.matchManager.byMatchUriOrThrow(matchUri);
        const migration = this.migrationHolder.getName();

        return `Migration: '${migration}', File: '${basename(matchUri.fsPath)}', Match: '${match.match.label}'`;
    }
}
