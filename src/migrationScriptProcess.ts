import { MigrationHolder } from "./migration/migrationHolder";
import { MigrationLoader } from "./migration/migrationLoader";

const migrationLoader = new MigrationLoader();
const migrationHolder = new MigrationHolder(migrationLoader);

const targets = {
    migrationHolder,
    migrationLoader
};

process.on("message", async (message) => {
    console.log(message);
    const targetName = message.target;
    const methodName = message.methodName;
    const args = message.args || [];
    const invocationId = message.invocationId;

    const target = (targets as any)[targetName];

    try {
        const result = await target[methodName](...args);
        process.send!({
            invocationId,
            result
        });
    } catch (error) {
        process.send!({
            invocationId,
            error
        });
    }
});

setInterval(() => { }, 1 << 30);