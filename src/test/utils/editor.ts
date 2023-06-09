import { FileChangeType, Uri } from "vscode";
import { TYPES } from "../../di/types";
import { MatchFileSystemProvider } from "../../providers/matchFileSystemProvider";
import { stringify } from "../../utils/uri";
import { Logger } from "../logger";
import { TEST_TYPES } from "../types";
import { Decoration } from "./coverageDecorations";
import { getWindow } from "./gui";
import { getCommands } from "./commands";


export async function getChangedContentFor(matchUri: Uri): Promise<string> {
    const buffer = await getContentProvider().readFile(matchUri);
    getContentProvider().watch(matchUri);
    return buffer.toString();
}

export function updateOf(matchUri: Uri): Promise<void> {
    const stringifiedUri = stringify(matchUri);

    return new Promise(res => {
        getContentProvider().onDidChangeFile(updatedFiles => {
            if (updatedFiles.find(file =>
                stringify(file.uri) === stringifiedUri
                && file.type === FileChangeType.Changed
            )) {
                log(`File ${stringifiedUri} received an update.`);
                res();
            }
        });
    });
}

export async function modifyContent(matchUri: Uri, callback: (originalContent: string) => string): Promise<void> {
    log(`Modifying content of ${matchUri}`);
    const originalBuffer = await getContentProvider().readFile(matchUri);
    getContentProvider().watch(matchUri);
    const originalContent = originalBuffer.toString();
    const newContent = callback(originalContent);
    const buffer = Buffer.from(newContent);
    getContentProvider().writeFile(matchUri, buffer, { create: false, overwrite: true });
    log(`Modified content of ${matchUri}`);
}

function getContentProvider(): MatchFileSystemProvider {
    return scenario.get(TYPES.MatchFileSystemProvider);
}

function log(message: string): void {
    const logger = scenario.get<Logger>(TEST_TYPES.Logger);
    logger.log("Editor: " + message);
}
