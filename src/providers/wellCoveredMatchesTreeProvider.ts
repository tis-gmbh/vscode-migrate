import { inject, injectable } from "inversify";
import { TYPES, VSC_TYPES, VscCommands } from "../di/types";
import { MatchCoverageFilter } from "./matchCoverageFilter";
import { MatchTreeProvider } from "./matchTreeProvider";

@injectable()
export class WellCoveredMatchesTreeProvider extends MatchTreeProvider {
    public constructor(
        @inject(TYPES.MatchCoverageFilter) matchCoverageFilter: MatchCoverageFilter,
        @inject(VSC_TYPES.VscCommands) private readonly commands: VscCommands
    ) {
        super(matchCoverageFilter);
    }

    public async getQueuedFiles(): Promise<string[]> {
        const files = await super.getQueuedFiles();

        void this.commands.executeCommand("setContext", "vscode-migrate.hasWellCoveredMatches", files.length > 0);

        return files;
    }
}
