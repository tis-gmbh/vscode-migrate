import { inject, injectable } from "inversify";
import { LcovLine } from "lcov-parse";
import { DecorationOptions, EventEmitter, Position, ProviderResult, Range, TextDocument, TextEditor, ThemableDecorationAttachmentRenderOptions } from "vscode";
import { TYPES, VSC_TYPES, VscWindow } from "../di/types";
import { MigrationOutputChannel } from "../migration/migrationOutputChannel";
import { stringify } from "../utils/uri";
import { CoverageProvider } from "./coverageProvider";
import { TextDecorationProvider } from "./textDecorationProvider";

@injectable()
export class CoverageDecorationProvider implements TextDecorationProvider {
    public readonly decorationType = this.window.createTextEditorDecorationType({});
    private readonly _onDecorationsChanged = new EventEmitter<TextEditor[]>();
    public readonly onDecorationsChanged = this._onDecorationsChanged.event;

    public constructor(
        @inject(TYPES.CoverageProvider) private readonly coverageProvider: CoverageProvider,
        @inject(VSC_TYPES.VscWindow) private readonly window: VscWindow,
        @inject(TYPES.MigrationOutputChannel) private readonly outputChannel: MigrationOutputChannel,
    ) {
        this.outputChannel.append("CoverageDecorationProvider created\n");
        this.coverageProvider.onCoverageChanged(this.onCoverageChanged, this);
    }

    private onCoverageChanged(changedFiles: string[] | undefined): void {
        const changedEditors = this.window.visibleTextEditors.filter(
            editor => changedFiles?.includes(stringify(editor.document.uri))
        );
        this.outputChannel.append(`Coverage changed for editors with uri ${changedEditors.map(editor => stringify(editor.document.uri))}\n`);
        this._onDecorationsChanged.fire(changedEditors);
    }

    public getDecorations(editor: TextEditor): ProviderResult<DecorationOptions[]> {
        if (!this.isLeftSideOfChangePreview(editor)) { return []; }
        return this.getDecorationsFor(editor.document);
    }

    private isLeftSideOfChangePreview(editor: TextEditor): boolean {
        const visibleEditors = this.window.visibleTextEditors;
        const editorIndex = visibleEditors.indexOf(editor);
        const nextEditor = visibleEditors[editorIndex + 1];
        return nextEditor?.document.uri.scheme === "match";
    }

    public getDecorationsFor(document: TextDocument): DecorationOptions[] {
        const info = this.coverageProvider.getInfoFor(document.uri);
        if (!info) return [];

        const lineCount = document.lineCount;
        const lineCoverage = Array.from(info.lines.details);

        const decorations: DecorationOptions[] = [];
        let nextLine = lineCoverage.shift();
        for (let lineNumber = 1; lineNumber < lineCount + 1; lineNumber++) {
            if (nextLine?.line === lineNumber) {
                decorations.push(this.getDecorationFor(lineNumber, nextLine));
                nextLine = lineCoverage.shift();
            } else {
                decorations.push(this.getDecorationFor(lineNumber));
            }
        }
        return decorations;
    }

    private getDecorationFor(lineNumber: number, line?: LcovLine): DecorationOptions {
        return {
            range: new Range(new Position(lineNumber - 1, 0), new Position(lineNumber, 0)),
            renderOptions: {
                before: this.getRenderOptionsFor(line)
            }
        };
    }

    private getRenderOptionsFor(line?: LcovLine): ThemableDecorationAttachmentRenderOptions {
        const attachmentRenderOptions: ThemableDecorationAttachmentRenderOptions = {
            contentText: "     ",
            width: "5ch"
        };
        if (line) {
            attachmentRenderOptions["color"] = line.hit ? "lime" : "red";
            attachmentRenderOptions["contentText"] = (line.hit + "x").padStart(5, " ");
        }
        return attachmentRenderOptions;
    }
}
