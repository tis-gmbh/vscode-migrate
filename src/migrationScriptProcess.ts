import { RpcProvider } from "worker-rpc";
import { MigrationHolder } from "./migration/migrationHolder";
import { MigrationLoader } from "./migration/migrationLoader";
import { CommitInfo } from "./migrationTypes";
import { RPCInterface } from "./rpcMethods";

/* eslint-disable no-console */
console.log = log;
console.debug = log;
console.info = log;
console.warn = log;
console.error = log;
console.trace = log;
console.dir = log;
console.dirxml = log;
console.table = log;
/* eslint-enable no-console */

function log(...args: any[]): void {
    // eslint-disable-next-line no-console
    rpcProvider.rpc("log", args).catch(() => { });
}


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

const rpcProvider = new RpcProvider(message => {
    if (message.id !== "log") {
        log(`Sending message ${JSON.stringify(message)} `);
    }
    if (message.payload instanceof Error) {
        message.payload = {
            isError: true,
            name: message.payload.name,
            message: message.payload.message,
            stack: message.payload.stack
        };
    }
    process.send!(message);
});


for (const [name, method] of Object.entries(handler)) {
    rpcProvider.registerRpcHandler(name, async (args: any[]) => {
        try {
            log(`RPC ${name} called with args ${JSON.stringify(args)} `);
            const result = await method(...args);
            log(`RPC ${name} called with args ${JSON.stringify(args)} returned ${JSON.stringify(result)} `);
            return result;
        } catch (error: any) {
            log(`RPC ${name} called with args ${JSON.stringify(args)} and threw the following error.`);
            log(error);
            throw error;
        }
    });
}

process.on("message", message => {
    rpcProvider.dispatch(message);
});

process.on("disconnect", () => {
    // parent process has exited
    process.exit(0);
});

setInterval(() => { }, 1 << 30);
