import { expect } from "chai";
import { TYPES } from "../../di/types";
import { MigrationScriptProcessController } from "../../migrationScriptProcessController";
import { getDebugStarts, killProcess, startDebugging, stopMigration } from "../utils/process";
import { getDisplayedTree } from "../utils/tree";

suite("Migration Script Process", () => {
    test("can be debugged", async () => {
        await scenario.load("singleFile");

        await startDebugging("Brackets");

        const debugPort = await scenario.get<MigrationScriptProcessController>(TYPES.MigrationScriptProcessController).send("getDebugPort");

        expect(getDebugStarts()).to.deep.equal([{
            folder: undefined,
            nameOrConfiguration: {
                type: "pwa-node",
                request: "attach",
                name: "Attach to Migration Script Process",
                port: debugPort,
                protocol: "inspector",
                skipFiles: [
                    "<node_internals>/**"
                ],
                pauseForSourceMap: true
            },
            parentSessionOrOptions: undefined
        }]);
    });

    test("clears matches when migration process is killed", async () => {
        await scenario.load("singleFile", "Brackets");

        await killProcess();

        const actualTree = await getDisplayedTree();
        const expectedTree = {};
        expect(actualTree).to.deep.equal(expectedTree);
    });

    test("is terminated if migration is stopped", async () => {
        await scenario.load("singleFile", "Brackets");

        await stopMigration();

        const migrationScriptProcess = scenario.get<MigrationScriptProcessController>(TYPES.MigrationScriptProcessController);
        expect(migrationScriptProcess.isRunning).to.be.false;
    });

    test("rejects command if migration fails to start", async () => {
        await expect(scenario.load("singleFile", "Suicidal")).to.eventually.be.rejectedWith("I am a suicidal migration script");
    });

    test("rejects command if migration script process dies", async () => {
        await expect(scenario.load("singleFile", "Lazy Suicidal")).to.eventually.be.rejectedWith("Migration Script Process died.");
    });
});
