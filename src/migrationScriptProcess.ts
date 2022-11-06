console.log(`MigrationScriptProcess up and running with id ${process.pid}`);
process.on("uncaughtException", error => process.send!(JSON.stringify(error)));
import { RpcProvider } from "worker-rpc";
import { MigrationHolder } from "./migration/migrationHolder";
import { MigrationLoader } from "./migration/migrationLoader";
import { CommitInfo } from "./migrationTypes";
import { RPCInterface } from "./rpcMethods";

const migrationLoader = new MigrationLoader();
const migrationHolder = new MigrationHolder(migrationLoader);

const handler: RPCInterface = {
    startMigration(migrationName: string) {
        return migrationHolder.start(migrationName);
    },
    stopMigration() {
        return migrationHolder.stop();
    },
    getMigrationName() {
        return migrationHolder.getName();
    },
    getMatchedFiles() {
        return migrationHolder.getMatchedFiles();
    },
    getCommitMessage(commitInfo: CommitInfo) {
        return migrationHolder.getCommitMessage(commitInfo);
    },
    getMigrationNames() {
        return migrationLoader.getNames();
    },
    refreshMigrations(dir: string) {
        return migrationLoader.refresh(dir);
    },
    verify() {
        return migrationHolder.verify();
    },
    getDebugPort() {
        return Promise.resolve(process.debugPort);
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
