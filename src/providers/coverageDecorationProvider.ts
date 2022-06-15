import { inject, injectable } from "inversify";
import { LcovFile, LcovLine, source as parseLcov } from "lcov-parse";
import { DecorationOptions, EventEmitter, Position, ProviderResult, Range, RelativePattern, TextDocument, TextEditor, ThemableDecorationAttachmentRenderOptions, Uri } from "vscode";
import { VscWindow, VscWorkspace, VSC_TYPES } from "../di/types";
import { stringify } from "../utils/uri";
import { TextDecorationProvider } from "./textDecorationProvider";

@injectable()
export class CoverageDecorationProvider implements TextDecorationProvider {
    public readonly decorationType = this.window.createTextEditorDecorationType({});
    private coverageInfo: Record<string, LcovFile> = {};
    private readonly ready: Promise<void>;

    private readonly changeEmitter = new EventEmitter<TextEditor[] | undefined>();
    public readonly onDecorationsChanged = this.changeEmitter.event;

    public constructor(
        @inject(VSC_TYPES.VscWindow) private readonly window: VscWindow,
        @inject(VSC_TYPES.VscWorkspace) private readonly workspace: VscWorkspace,
    ) {
        this.ready = this.setupFileWatcher();
    }

    private async setupFileWatcher(): Promise<void> {
        const pattern = new RelativePattern(this.workspace.workspaceFolders![0]!.uri.fsPath, "coverage/lcov.info");
        const watcher = this.workspace.createFileSystemWatcher(pattern);
        watcher.onDidChange(file => this.updateCoverageUsing(file));
        watcher.onDidCreate(file => this.updateCoverageUsing(file));
        watcher.onDidDelete(() => this.coverageInfo = {});

        const files = await this.workspace.findFiles(pattern);
        if (files[0]) {
            await this.updateCoverageUsing(files[0]);
        }
    }

    private async updateCoverageUsing(file: Uri): Promise<void> {
        await this.loadAndUpdateCoverageFrom(file);
        this.changeEmitter.fire(undefined);
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

    private updateCoverage(fileCoverages: LcovFile[]): void {
        const newCoverageInfo: Record<string, LcovFile> = {};
        const workspaceFolder = this.workspace.workspaceFolders![0]!.uri;

        for (const fileCoverage of fileCoverages) {
            const uri = Uri.joinPath(workspaceFolder, fileCoverage.file.replace(/\\/g, "/"));
            newCoverageInfo[stringify(uri)] = fileCoverage;
        }

        this.coverageInfo = newCoverageInfo;
    }

    private async getCoverageInfoFrom(file: Uri): Promise<LcovFile[]> {
        try {
            const content = (await this.workspace.fs.readFile(file)).toString();
            return this.parseLcovAsync(content);
        } catch (error) {
            return [];
        }
    }

    private parseLcovAsync(lcov: string): Promise<LcovFile[]> {
        return new Promise((res, rej) => {
            parseLcov(lcov, (error, data) => {
                if (error) {
                    rej(error);
                    return;
                }
                res(data!);
            });
        });
    }

    private async loadAndUpdateCoverageFrom(file: Uri): Promise<void> {
        const fileCoverages = await this.getCoverageInfoFrom(file);
        this.updateCoverage(fileCoverages);
    }

    public async getDecorationsFor(document: TextDocument): Promise<DecorationOptions[]> {
        await this.ready;
        const info = this.coverageInfo[stringify(document.uri)];
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
