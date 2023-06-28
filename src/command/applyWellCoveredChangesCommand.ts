import { inject, injectable } from "inversify";
import { TYPES } from "../di/types";
import { MatchCollection } from "../test/utils/matchCollection";
import { VersionControl } from "../vcs/versionControl";
import { ApplyCommand } from "./applyCommand";
import { Command } from "./command";

@injectable()
export class ApplyWellCoveredChangesCommand extends ApplyCommand implements Command {
    public readonly id = "vscode-migrate.apply-well-covered-matches";

    @inject(TYPES.VersionControl)
    private readonly versionControl!: VersionControl;

    public async execute(): Promise<void> {
        const matches = await MatchCollection.fromMatchSource(this.matchManager);
        await this.tryApplyLocked(matches);
    }

    protected getProgressTitle(matches: MatchCollection): string {
        return `Applying ${matches.length} Well Covered Changes`;
    }

    protected async commitToVcs(matches: MatchCollection): Promise<void> {
        await this.versionControl.stageAll();
        await this.versionControl.commit(`Batch application of ${Object.values(matches).flat().length} well covered matches for migration 'Brackets'`);
    }
}
