import { extname, join } from "path";
import { MigrationConstructor, MigrationFactory } from "../migrationTypes";
import glob = require("matched");

const migrations: Record<string, MigrationFactory> = {};

global.registerMigration = (name: string, migrationFactory: MigrationFactory | MigrationConstructor): void => {
    migrations[name] = wrapConstructor(migrationFactory);
};

global.Migration = (options: { name: string, factory?: MigrationFactory }): (target: MigrationConstructor) => void => {
    return (target: MigrationConstructor): void => {
        registerMigration(options.name, options.factory || target);
    };
};

export class MigrationLoader {
    private migrationScriptErrors: Record<string, any> = {};

    public async refresh(dir: string): Promise<Record<string, any>> {
        let files = await glob(["*[!.d].{js,ts}"], { cwd: dir });
        files = files.map(file => join(dir, file));
        files = this.filterTsMigrations(dir, files);
        await this.fetchMigrationsFrom(files);
        return this.migrationScriptErrors;
    }

    private async fetchMigrationsFrom(files: string[]): Promise<void> {
        for (const file of files) {
            await this.tryRequireAsync(file);
        }
    }

    private filterTsMigrations(dir: string, files: string[]): string[] {
        const tsMigrationsExist = files.some(isTsString);
        if (!tsMigrationsExist) return files;
        if (!this.tryRegisterTsNode(dir)) {
            return files.filter((uri) => {
                if (isTsString(uri)) {
                    this.migrationScriptErrors[uri] = new Error("Migration is written in TypeScript, but ts-node is not installed");
                }
                return true;
            });
        }
        return files;
    }

    private tryRegisterTsNode(dir: string): boolean {
        try {
            this.registerTsNode(dir);
            return true;
        } catch (error: any) {
            if (error.code === "MODULE_NOT_FOUND") {
                return false;
            }
            throw error;
        }
    }

    private registerTsNode(dir: string): void {
        const path = this.require.resolve("ts-node", {
            paths: [dir]
        });
        this.require(path).register({
            projectSearchDir: dir,
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
        return typeof __non_webpack_require__ !== "undefined" ? __non_webpack_require__ : require;
    }

    private async tryRequireAsync(file: string): Promise<void> {
        try {
            await this.requireAsync(file);
        } catch (error: any) {
            this.migrationScriptErrors[file] = {
                message: error.message,
                stack: error.stack,
                code: error.code
            };
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

    public getNames(): string[] {
        return Object.keys(migrations);
    }

    public getFactory(migrationName: string): MigrationFactory | undefined {
        return migrations[migrationName];
    }
}


const isTsString = (file: string): boolean => extname(file) === ".ts";

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
