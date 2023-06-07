import { DecorationInstanceRenderOptions, FileChangeType, TextDocument, Uri, Range as VscRange } from "vscode";
import { TYPES } from "../../di/types";
import { CoverageDecorationProvider } from "../../providers/coverageDecorationProvider";
import { MatchFileSystemProvider } from "../../providers/matchFileSystemProvider";
import { stringify } from "../../utils/uri";
import { Logger } from "../logger";
import { Decoration } from "../suite/scenario";
import { TEST_TYPES } from "../types";
import { getWindow } from "./gui";


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

export function getDecorationsFor(fileUri: Uri): Decoration[] {
    const originalDecorations = getCoverageDecorationProvider().getDecorationsFor({
        lineCount: 12,
        uri: fileUri
    } as Partial<TextDocument> as TextDocument);
    return originalDecorations.map(decoration => {
        return {
            range: transformRange(decoration.range),
            options: decoration.renderOptions
        };
    });
}

export function createCoverageScheme(executions: Array<number | null>): Decoration[] {
    return executions.map((hits, lineNumber) => {
        return {
            range: getDecorationRangeForLine(lineNumber),
            options: getOptionsForHits(hits)
        };
    });
}

function getOptionsForHits(hits: number | null = null): DecorationInstanceRenderOptions {
    const options: DecorationInstanceRenderOptions = {
        before: {
            contentText: getHitText(hits),
            width: "5ch"
        }
    };
    const color = getHitColor(hits);
    if (color) {
        options.before!.color = color;
    }
    return options;
}

function getDecorationRangeForLine(l: number): Range {
    return {
        start: {
            line: l,
            character: 0,
        },
        end: {
            line: l + 1,
            character: 0
        }
    };
}

function getHitText(hits: number | null): string {
    if (hits === null) {
        return "     ";
    }
    return `${hits}x`.padStart(5, " ");
}

function getHitColor(hits: number | null): string | undefined {
    if (hits === null) {
        return undefined;
    }
    if (hits > 0) {
        return "lime";
    }
    return "red";
}

function getContentProvider(): MatchFileSystemProvider {
    return scenario.get(TYPES.MatchFileSystemProvider);
}

function getCoverageDecorationProvider(): CoverageDecorationProvider {
    return scenario.get(TYPES.CoverageDecorationProvider);
}

function log(message: string): void {
    const logger = scenario.get<Logger>(TEST_TYPES.Logger);
    logger.log("Editor: " + message);
}

export function transformRange(range: VscRange): Range {
    return {
        start: {
            line: range.start.line,
            character: range.start.character
        },
        end: {
            line: range.end.line,
            character: range.end.character
        }
    };
}

interface Position {
    line: number;
    character: number;
}

interface Range {
    start: Position;
    end: Position;
}
