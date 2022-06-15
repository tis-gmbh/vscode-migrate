import { inject, injectable } from "inversify";
import { basename, extname, join } from "path";
import { OutputChannel, Progress, ProgressLocation, RelativePattern, Uri } from "vscode";
import { VscWindow, VscWorkspace, VSC_TYPES } from "../di/types";
import { MigrationConstructor, MigrationFactory } from "../migrationTypes";

const migrations: Record<string, MigrationFactory> = {};

global.registerMigration = (name: string, migrationFactory: MigrationFactory | MigrationConstructor): void => {
    migrations[name] = wrapConstructor(migrationFactory);
};

global.Migration = (options: { name: string, factory?: MigrationFactory }): (target: MigrationConstructor) => void => {
    return (target: MigrationConstructor): void => {
        registerMigration(options.name, options.factory || target);
    };
};


@injectable()
export class MigrationLoader {
    private progress?: Progress<{ message: string }>;
    private readonly outputChannel: OutputChannel;

    public constructor(
        @inject(VSC_TYPES.VscWorkspace) private readonly workspace: VscWorkspace,
        @inject(VSC_TYPES.VscWindow) private readonly window: VscWindow
    ) {
        this.outputChannel = this.window.createOutputChannel("Migration Loader");
    }

    public refresh(): Thenable<void> {
        return this.window.withProgress({
            title: "Looking for migrations",
            location: ProgressLocation.Notification,
            cancellable: false
        }, async (progress) => {
            this.progress = progress;
            this.updateProgress("Finding files...");
            const pattern = new RelativePattern(this.migrationDir, "*[!.d].{js,ts}");
            let files = await this.workspace.findFiles(pattern);
            files = this.filterTsMigrations(files);
            await this.fetchMigrationsFrom(files);
        });
    }

    private async fetchMigrationsFrom(files: Uri[]): Promise<void> {
        for (const file of files) {
            await this.tryRequireAsync(file);
        }
    }

    private updateProgress(message: string): void {
        this.progress?.report({ message: message });
    }

    private get migrationDir(): string {
        return join(this.workspace.workspaceFolders![0]!.uri.fsPath, ".vscode/migrations/");
    }

    private filterTsMigrations(files: Uri[]): Uri[] {
        const tsMigrationsExist = files.some(isTsUri);
        if (!tsMigrationsExist) return files;
        if (!this.tryRegisterTsNode()) return files.filter(isNoTsUri);
        return files;
    }

    private tryRegisterTsNode(): boolean {
        try {
            this.registerTsNode();
            return true;
        } catch (error: any) {
            if (error.code === "MODULE_NOT_FOUND") {
                void this.window.showWarningMessage("ts-node is not installed. Migration files written in typescript will be ignored.");
                return false;
            }
            throw error;
        }
    }

    private registerTsNode(): void {
        const path = this.require.resolve("ts-node", {
            paths: [this.migrationDir]
        });
        this.require(path).register({
            projectSearchDir: this.migrationDir,
            compilerOptions: {
                target: "es2020",
                module: "commonjs",
                noEmitHelpers: false,
                types: [
                    "node"
                ]
            }
        });
    }

    private get require(): typeof require {
        return __non_webpack_require__;
    }

    private async tryRequireAsync(file: Uri): Promise<void> {
        try {
            this.updateProgress(`Loading ${basename(file.fsPath)}...`);
            await this.requireAsync(file.fsPath);
        } catch (error) {
            this.handleMigrationLoadError(file, error);
        }
    }

    private requireAsync(filePath: string): Promise<void> {
        return new Promise((res, rej) => {
            setTimeout(() => {
                try {
                    this.require(filePath);
                    res();
                } catch (error) {
                    rej(error);
                }
            }, 0);
        });
    }

    private handleMigrationLoadError(file: Uri, error: any): void {
        void this.window.showErrorMessage(`Failed to load ${basename(file.fsPath)}. Check the output for details.`);
        this.outputChannel.append(error.stack);
    }

    public getNames(): string[] {
        return Object.keys(migrations);
    }

    public getFactory(migrationName: string): MigrationFactory | undefined {
        return migrations[migrationName];
    }
}


const isTsUri = (file: Uri): boolean => extname(file.fsPath) === ".ts";
const isNoTsUri = (file: Uri): boolean => !isTsUri(file);

type FactoryType<T> = () => T;
type ConstructorType<T> = new () => T;
const wrapConstructor = <T>(factoryOrConstructor: FactoryType<T> | ConstructorType<T>): FactoryType<T> => {
    if (isConstructor(factoryOrConstructor)) {
        return () => new factoryOrConstructor();
    }
    return factoryOrConstructor;
};

const isConstructor = <T>(factoryOrConstructor: FactoryType<T> | ConstructorType<T>): factoryOrConstructor is ConstructorType<T> => {
    return factoryOrConstructor.prototype.constructor;
};

