import { TYPES } from "../../di/types";
import { MatchManager } from "../../migration/matchManger";

export function updatePass(): Promise<void> {
    let wasUpdating = false;
    return new Promise(resolve => {
        const matchManager = scenario.get<MatchManager>(TYPES.MatchManager);
        const disposable = matchManager.onStateChange(state => {
            const isUpdating = state === "updating";
            if (!wasUpdating && isUpdating) {
                wasUpdating = true;
            } else if (wasUpdating && !isUpdating) {
                disposable.dispose();
                resolve();
                return;
            }
        });
    });
}
