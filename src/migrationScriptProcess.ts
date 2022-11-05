console.log(`MigrationScriptProcess up and running with id ${process.pid}`);
process.on("uncaughtException", error => process.send!(JSON.stringify(error)));
import { RpcProvider } from "worker-rpc";
import { MigrationHolder } from "./migration/migrationHolder";
import { MigrationLoader } from "./migration/migrationLoader";
import { CommitInfo, MatchedFile } from "./migrationTypes";
import { RPCInterface } from "./rpcMethods";

const migrationLoader = new MigrationLoader();
const migrationHolder = new MigrationHolder(migrationLoader);

const handler: RPCInterface = {
    startMigration: function (migrationName: string): Promise<void> {
        return migrationHolder.start(migrationName);
    },
    stopMigration: function (): void {
        return migrationHolder.stop();
    },
    getMigrationName: function (): string | undefined {
        return migrationHolder.getName();
    },
    getMatchedFiles: function (): Promise<MatchedFile[]> {
        return migrationHolder.getMatchedFiles();
    },
    getCommitMessage: function (commitInfo: CommitInfo): Promise<string | undefined> {
        return migrationHolder.getCommitMessage(commitInfo);
    },
    getMigrationNames: function (): string[] {
        return migrationLoader.getNames();
    },
    refreshMigrations: function (dir: string): Promise<Record<string, any>> {
        return migrationLoader.refresh(dir);
    },
    verify: function (): Promise<void> {
        return migrationHolder.verify();
    }
};

const rpcProvider = new RpcProvider(message => process.send!(message));
for (const [name, method] of Object.entries(handler)) {
    rpcProvider.registerRpcHandler(name, async (args: any[]) => {
        try {
            const result = await method(...args);
            console.log(`RPC ${name} called with args ${JSON.stringify(args)} and returned ${JSON.stringify(result)}`);
            return result;
        } catch (error: any) {
            console.log(`RPC ${name} called with args ${JSON.stringify(args)} and threw ${JSON.stringify(error)}`);
            throw error;
        }
    });
}
process.on("message", message => {
    rpcProvider.dispatch(message);
});

setInterval(() => { }, 1 << 30);
