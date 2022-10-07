console.log(`MigrationScriptProcess up and running with id ${process.pid}`);
process.on("uncaughtException", error => process.send!(JSON.stringify(error)));
import { MigrationHolder } from "./migration/migrationHolder";
import { MigrationLoader } from "./migration/migrationLoader";

const migrationLoader = new MigrationLoader();
const migrationHolder = new MigrationHolder(migrationLoader);

const targets = {
    migrationHolder,
    migrationLoader
};
// process.on("SIGPIPE", console.error);
process.on("message", async (message) => {
    console.log(message);
    const targetName = message.target;
    const methodName = message.methodName;
    const args = message.args || [];
    const invocationId = message.invocationId;

    const target = (targets as any)[targetName];

    try {
        const result = await target[methodName](...args);
        process.send!(JSON.stringify({
            invocationId,
            result
        }));
    } catch (error) {
        process.send!(JSON.stringify({
            invocationId,
            error: {
                message: (error as any).message,
                stack: (error as any).stack
            }
        }));
    }
});
setInterval(() => { }, 1 << 30);