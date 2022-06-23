import { inject, injectable } from "inversify";
import { Uri } from "vscode";
import { TYPES, VscWorkspace, VSC_TYPES } from "../di/types";
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
        @inject(TYPES.GitExtension) private readonly gitExtension: GitExtension,
        @inject(VSC_TYPES.VscWorkspace) private readonly workspace: VscWorkspace,
    ) { }

    public async stageAndCommit(matchUri: Uri): Promise<void> {
        this.gitApi = await this.gitExtension.getGitApi();
        await this.stage(matchUri);
        await this.commit(matchUri);
    }

    private async stage(matchUri: Uri): Promise<void> {
        const fileUri = toFileUri(matchUri);
        const repo = this.getRepoOrThrow(fileUri);
        await repo.status();
        const changes = repo.state.workingTreeChanges;
        await repo.add(changes.map(change => change.uri.fsPath));
    }

    private getRepoOrThrow(fileUri: Uri): Repository {
        const repo = this.gitApi.getRepository(fileUri);
        if (!repo) throw new Error("Modified file is not in a repo.");
        return repo;
    }

    private async commit(matchUri: Uri): Promise<void> {
        const fileUri = toFileUri(matchUri);
        const commitMessage = await this.getCommitMessageFor(matchUri);
        const repo = this.getRepoOrThrow(fileUri);
        await repo.commit(commitMessage, { noVerify: true });
    }

    private async getCommitMessageFor(matchUri: Uri): Promise<string> {
        const match = this.matchManager.byMatchUriOrThrow(matchUri);
        const commitMessage = await this.migrationHolder.getCommitMessage({
            filePath: matchUri.fsPath,
            matchLabel: match.match.label,
        });

        return commitMessage || this.getDefaultMessageFor(matchUri);
    }

    private getDefaultMessageFor(matchUri: Uri): string {
        const match = this.matchManager.byMatchUriOrThrow(matchUri);
        const migration = this.migrationHolder.getName();
        const relativePath = this.workspace.asRelativePath(toFileUri(matchUri));

        return `(Auto) Migration '${migration}' for '${relativePath}' labeled '${match.match.label}'`;
    }
}
