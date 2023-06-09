import { inject, injectable } from "inversify";
import { DecorationInstanceRenderOptions, TextDocument, TextEditor, Uri, Range as VscRange } from "vscode";
import { TYPES, VSC_TYPES, VscWindow } from "../../di/types";
import { CoverageDecorationProvider } from "../../providers/coverageDecorationProvider";
import { stringify } from "../../utils/uri";
import { TEST_TYPES } from "../types";
import { AwaitEntryArray } from "./awaitEntryArray";
import { getCommands } from "./commands";

export interface Decoration {
    range: Range
    options?: DecorationInstanceRenderOptions;
}

interface Range {
    start: Position;
    end: Position;
}

interface Position {
    line: number;
    character: number;
}

@injectable()
export class CoverageDecorationsObserver {
    public readonly decorations: Record<string, AwaitEntryArray<Decoration[]>> = {};

    public constructor(
        @inject(TYPES.CoverageDecorationProvider) private readonly coverageDecorationProvider: CoverageDecorationProvider,
        @inject(VSC_TYPES.VscWindow) private readonly window: VscWindow
    ) {
        this.coverageDecorationProvider.onDecorationsChanged(this.onDecorationsChanged.bind(this));
        this.window.onDidChangeVisibleTextEditors(this.onDecorationsChanged.bind(this));
        this.onDecorationsChanged(this.window.visibleTextEditors);
    }

    private onDecorationsChanged(editors: readonly TextEditor[]): void {
        for (const editor of editors) {
            const uri = stringify(editor.document.uri);
            const decorations = this.decorations[uri] ??= new AwaitEntryArray();
            decorations.push(getDecorationsFor(editor.document.uri));
        }
    }
}

export async function coverageDecorations(editor: Uri, decorations: Decoration[]): Promise<Decoration[]> {
    await getCommands().executeCommand("vscode.open", editor);
    const decorationRecords = getObserver().decorations[stringify(editor)] ??= new AwaitEntryArray(decorations);
    return decorationRecords.awaitEntryMatching(decorations);
}

function getObserver(): CoverageDecorationsObserver {
    return scenario.get(TEST_TYPES.CoverageDecorationsObserver);
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

function getCoverageDecorationProvider(): CoverageDecorationProvider {
    return scenario.get(TYPES.CoverageDecorationProvider);
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
