import { inject, injectable } from "inversify";
import { Uri } from "vscode";
import { TYPES } from "../di/types";
import { MatchCollection } from "../test/utils/matchCollection";
import { VersionControl } from "../vcs/versionControl";
import { ApplyCommand, WindowProgress } from "./applyCommand";
import { Command } from "./command";

@injectable()
export class ApplyChangeCommand extends ApplyCommand implements Command {
    public readonly id = "vscode-migrate.apply-change";

    @inject(TYPES.VersionControl)
    private readonly versionControl!: VersionControl;

    public async execute(matchUri: Uri): Promise<void> {
        const collection = new MatchCollection();
        collection.push(matchUri);
        await this.tryApplyLocked(collection);
    }

    protected getProgressTitle(matches: MatchCollection): string {
        const matchUri = matches[0]!;
        const match = this.matchManager.byMatchUriOrThrow(matchUri);
        return `Applying Change ${match.match.label}`;
    }

    protected async commitToVcs(matches: MatchCollection, progress: WindowProgress): Promise<void> {
        const matchUri = matches[0]!;
        progress.report({ message: "Committing file" });
        await this.versionControl.stageAndCommit(matchUri);
    }
}
