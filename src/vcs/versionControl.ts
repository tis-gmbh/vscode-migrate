import { inject, injectable } from "inversify";
import { Uri } from "vscode";
import { TYPES, VscWorkspace, VSC_TYPES } from "../di/types";
import { MatchManager } from "../migration/matchManger";
import { MigrationHolderRemote } from "../migration/migrationHolderRemote";
import { toFileUri } from "../utils/uri";
import { Repository } from "./git";
import { GitExtension } from "./gitExtension";

@injectable()
export class VersionControl {

    public constructor(
        @inject(TYPES.MatchManager) private readonly matchManager: MatchManager,
        @inject(TYPES.MigrationHolderRemote) private readonly migrationHolder: MigrationHolderRemote,
        @inject(TYPES.GitExtension) private readonly gitExtension: GitExtension,
        @inject(VSC_TYPES.VscWorkspace) private readonly workspace: VscWorkspace,
    ) { }

    public async stageAndCommit(matchUri: Uri): Promise<void> {
        await this.stageAll();
        await this.commit(await this.getCommitMessageFor(matchUri));
    }

    public async stageAll(): Promise<void> {
        const repo = await this.getWorkspaceRepo();
        await repo.status();
        const changes = repo.state.workingTreeChanges;
        await repo.add(changes.map(change => change.uri.fsPath));
    }

    private async getWorkspaceRepo(): Promise<Repository> {
        const fileUri = this.workspace.workspaceFolders?.[0]?.uri;
        if (!fileUri) throw new Error("No workspace folder found.");

        const gitApi = await this.gitExtension.getGitApi();
        const repo = gitApi.getRepository(fileUri);
        if (!repo) throw new Error("Workspace is not a git repository.");
        return repo;
    }

    public async commit(message: string): Promise<void> {
        const repo = await this.getWorkspaceRepo();
        await repo.commit(message, { noVerify: true });
    }

    private async getCommitMessageFor(matchUri: Uri): Promise<string> {
        const match = this.matchManager.byMatchUriOrThrow(matchUri);
        const commitMessage = await this.migrationHolder.getCommitMessage({
            filePath: matchUri.fsPath,
            matchLabel: match.match.label,
        });

        return commitMessage || await this.getDefaultMessageFor(matchUri);
    }

    private async getDefaultMessageFor(matchUri: Uri): Promise<string> {
        const match = this.matchManager.byMatchUriOrThrow(matchUri);
        const migration = await this.migrationHolder.getName();
        const relativePath = this.workspace.asRelativePath(toFileUri(matchUri));

        return `(Auto) Migration '${migration}' for '${relativePath}' labeled '${match.match.label}'`;
    }
}
