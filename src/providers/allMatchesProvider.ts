import { inject, injectable } from "inversify";
import { TYPES } from "../di/types";
import { MatchManager } from "../migration/matchManger";
import { MatchTreeProvider } from "./matchTreeProvider";

@injectable()
export class AllMatchesProvider extends MatchTreeProvider {
    public constructor(
        @inject(TYPES.MatchManager) matchManager: MatchManager
    ) {
        super(matchManager);
    }
}
