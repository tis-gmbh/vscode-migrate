import { inject, injectable, preDestroy } from "inversify";
import { LcovFile, source as parseLcov } from "lcov-parse";
import { EventEmitter, FileSystemWatcher, RelativePattern, Uri } from "vscode";
import { TYPES, VSC_TYPES, VscWindow, VscWorkspace } from "../di/types";
import { MigrationHolderRemote } from "../migration/migrationHolderRemote";
import { MigrationOutputChannel } from "../migration/migrationOutputChannel";
import { stringify } from "../utils/uri";

@injectable()
export class CoverageProvider {
    private coverageInfo: Record<string, LcovFile> = {};
    private readonly changeEmitter = new EventEmitter<string[] | undefined>();
    public readonly onCoverageChanged = this.changeEmitter.event;
    private readonly coveragePattern: RelativePattern;
    private watcher?: FileSystemWatcher;

    public constructor(
        @inject(VSC_TYPES.VscWorkspace) private readonly workspace: VscWorkspace,
        @inject(VSC_TYPES.VscWindow) private readonly window: VscWindow,
        @inject(TYPES.MigrationOutputChannel) private readonly outputChannel: MigrationOutputChannel,
        @inject(TYPES.MigrationHolderRemote) private readonly migrationHolder: MigrationHolderRemote
    ) {
        this.coveragePattern = new RelativePattern(this.workspace.workspaceFolders![0]!.uri.fsPath, "coverage/lcov.info");
        this.migrationHolder.migrationChanged(() => this.onMigrationChanged());
    }

    private async onMigrationChanged(): Promise<void> {
        const migrationStarted = await this.migrationHolder.hasMigration();
        this.disposeFileWatcher();

        if (migrationStarted) {
            await this.setupFileWatcher();
        }
    }

    private async setupFileWatcher(): Promise<void> {
        this.watcher = this.workspace.createFileSystemWatcher(this.coveragePattern);
        this.watcher.onDidCreate(file => this.onCoverageFileCreated(file));
        this.watcher.onDidChange(file => this.onCoverageFileChanged(file));
        this.watcher.onDidDelete(() => this.onCoverageFileDeleted());

        const files = await this.workspace.findFiles(this.coveragePattern);
        if (files[0]) {
            this.outputChannel.append(`Initial coverage file found: ${files[0].fsPath}\n`);
            await this.updateCoverageUsing(files[0]);
        } else {
            this.showNoCoverageInfo();
        }
    }

    private onCoverageFileCreated(file: Uri): void {
        this.outputChannel.append(`Coverage file created: ${file.fsPath}\n`);
        void this.updateCoverageUsing(file);
    }

    private onCoverageFileChanged(file: Uri): void {
        this.outputChannel.append(`Coverage file changed: ${file.fsPath}\n`);
        void this.updateCoverageUsing(file);
    }

    private async updateCoverageUsing(file: Uri): Promise<void> {
        const fileCoverages = await this.getCoverageInfoFrom(file);
        const changedFiles = this.getChangedFiles(fileCoverages);
        this.updateCoverage(fileCoverages);
        this.changeEmitter.fire(changedFiles);
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

    private getChangedFiles(newCoverages: LcovFile[]): string[] {
        const changedFiles: string[] = [];
        for (const newCov of newCoverages) {
            const uri = this.getUriForLcov(newCov);
            const oldCov = this.getInfoFor(uri);
            const changed = JSON.stringify(oldCov) !== JSON.stringify(newCov);
            if (changed) {
                changedFiles.push(stringify(uri));
            }
        }
        return changedFiles;
    }

    private updateCoverage(fileCoverages: LcovFile[]): void {
        const newCoverageInfo: Record<string, LcovFile> = {};

        for (const fileCoverage of fileCoverages) {
            const uri = this.getUriForLcov(fileCoverage);
            newCoverageInfo[stringify(uri)] = fileCoverage;
        }

        this.coverageInfo = newCoverageInfo;
    }

    private getUriForLcov(fileCoverage: LcovFile): Uri {
        const workspaceFolder = this.workspace.workspaceFolders![0]!.uri;
        return Uri.joinPath(workspaceFolder, fileCoverage.file.replace(/\\/g, "/"));
    }

    private showNoCoverageInfo(): void {
        void this.window.showWarningMessage("VSCode Migrate is much more useful with coverage info, but was unable to find any at 'coverage/lcov.info'.");
    }

    private onCoverageFileDeleted(): void {
        this.outputChannel.append("Coverage file deleted.\n");
        this.coverageInfo = {};
        this.changeEmitter.fire(undefined);
    }

    @preDestroy()
    private disposeFileWatcher(): void {
        this.watcher?.dispose();
        this.onCoverageFileDeleted();
    }

    public isWellCovered(fileUri: Uri, startLine: number, endLine: number): boolean {
        const info = this.getInfoFor(fileUri);
        if (!info) return false;

        const lines = Array.from(info.lines.details);
        const linesInRange = lines.filter((line) => line.line >= startLine && line.line <= endLine);
        if (linesInRange.length === 0) {
            return (lines
                .reverse()
                .find(line => line.line < startLine)
                ?.hit || 0) > 0;
        }

        return linesInRange.every((line) => line.hit > 0);
    }

    public getInfoFor(fileUri: Uri): LcovFile | undefined {
        return this.coverageInfo[stringify(fileUri)];
    }
}
