import { Uri } from "vscode";
import { TYPES } from "../../di/types";
import { MatchManager } from "../../migration/matchManger";
import { toFileUri } from "../../utils/uri";
import { Logger } from "../logger";
import { Commit, GitExtensionStub } from "../stubs/gitExtension";
import { TEST_TYPES } from "../types";
import { execute } from "./commands";
import { setModified } from "./vcs";

export async function applyChangesFor(matchUri: Uri): Promise<void> {
    setModified(toFileUri(matchUri));
    await execute("vscode-migrate.apply-change", matchUri);
}

export async function applyAllFor(fileUri: Uri): Promise<void> {
    let currentMatches = getMatchManager().getMatchUrisByFileUri(fileUri);
    log(`Applying all ${currentMatches.length} changes for ${fileUri.fsPath}`);
    while (true) {
        const nextMatch = currentMatches[0];
        if (!nextMatch) break;
        await applyChangesFor(nextMatch);
        const newMatches = getMatchManager().getMatchUrisByFileUri(fileUri);
        if (currentMatches.length <= newMatches.length) throw new Error(`Stuck at applying ${newMatches.length} matches.`);
        currentMatches = newMatches;
    }
    log(`Applied all ${currentMatches.length} changes for ${fileUri.fsPath}`);
}

export function commits(): Commit[] {
    const gitStub = scenario.get<GitExtensionStub>(TEST_TYPES.GitExtension);
    return gitStub.commits;
}

function log(message: string): void {
    const logger = scenario.get<Logger>(TEST_TYPES.Logger);
    logger.log("Debugging: " + message);
}

function getMatchManager(): MatchManager {
    return scenario.get(TYPES.MatchManager);
}
