import { Uri } from "vscode";
import { GitExtensionStub } from "../stubs/gitExtension";
import { TEST_TYPES } from "../types";

export function setModified(fileUri: Uri): void {
    getGitStub().setModified(fileUri);
}

export function setUntracked(fileUri: Uri): void {
    getGitStub().setUntracked(fileUri);
}

function getGitStub(): GitExtensionStub {
    return scenario.get<GitExtensionStub>(TEST_TYPES.GitExtension);
}
